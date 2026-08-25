import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";
import { analyzeWithGemini } from "@/lib/ai/gemini";
import { buildAnalysisFromRaw } from "@/lib/ai/matchFood";
import { getFoodsIndex } from "@/lib/ai/foodsIndex";
import {
  GEMINI_DOWN_MESSAGE,
  isUpstreamGeminiFailure,
  OFF_TOPIC_MESSAGE,
} from "@/lib/ai/guard";

// Must stay above the Gemini chain deadline so a slow upstream returns a real
// error instead of being killed mid-flight. Ignored on Vercel Hobby, which
// caps every function at 10s — see the deadline defaults in lib/ai/gemini.ts.
export const maxDuration = 30;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_TEXT = 300;
// Base64 chars ≈ 1.37 × bytes. ~7M chars ≈ 5 MB decoded image.
const MAX_IMAGE_B64 = 7_000_000;

function dailyLimit(): number {
  const n = Number(process.env.AI_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 25;
}

type Body = { imageBase64?: string; mime?: string; text?: string };

export async function POST(req: Request) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const imageBase64 =
    typeof body.imageBase64 === "string" ? body.imageBase64 : "";
  const mime = typeof body.mime === "string" ? body.mime : "";

  // ── Input validation ──────────────────────────────────────────────
  if (!imageBase64 && !text) {
    return NextResponse.json(
      { error: "Priložite fotografiju ili opis hrane." },
      { status: 400 },
    );
  }
  if (text.length > MAX_TEXT) {
    return NextResponse.json(
      { error: `Opis je predug (max ${MAX_TEXT} znakova).` },
      { status: 400 },
    );
  }
  if (imageBase64) {
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: "Nepodržan format slike (koristite JPEG, PNG ili WebP)." },
        { status: 400 },
      );
    }
    if (imageBase64.length > MAX_IMAGE_B64) {
      return NextResponse.json(
        { error: "Slika je prevelika (max ~5 MB)." },
        { status: 413 },
      );
    }
  }

  // ── Rate limit (atomic increment + read-back) ─────────────────────
  const supa = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const { data: count, error: usageErr } = await supa.rpc("bump_ai_usage", {
    p_user_id: uid,
    p_date: today,
  });
  if (usageErr) {
    return NextResponse.json({ error: usageErr.message }, { status: 500 });
  }
  const limit = dailyLimit();
  if (typeof count === "number" && count > limit) {
    return NextResponse.json(
      {
        error: `Dosegnut je dnevni limit AI analiza (${limit}). Pokušajte ponovno sutra.`,
      },
      { status: 429 },
    );
  }

  // Warm the foods index while the model is thinking. buildAnalysisFromRaw
  // needs it, but only AFTER the model answers — loading it there put a cold
  // instance's ~1s table read in series behind the call instead of under it.
  // Failures are swallowed: the real getFoodsIndex() below will retry and
  // surface the error properly.
  void getFoodsIndex().catch(() => null);

  // Credits are reserved above and refunded here when Gemini never answered,
  // so an outage on Google's side doesn't eat the user's daily allowance.
  const refund = async () => {
    // Never let a refund failure mask the real error being returned.
    try {
      await supa.rpc("refund_ai_usage", { p_user_id: uid, p_date: today });
    } catch {
      /* best effort */
    }
  };

  // ── Gemini call ───────────────────────────────────────────────────
  // Tries the primary model, falls back across the configured chain if it's
  // overloaded / unavailable / returns unusable data.
  let raw, usedModel;
  try {
    ({ raw, model: usedModel } = await analyzeWithGemini({
      imageBase64,
      mime,
      text,
    }));
  } catch (e) {
    await refund();
    // Distinguish "Google's service is unavailable" from "we broke something".
    // `userMessage` is a deliberate, user-facing string the client shows
    // verbatim instead of its own generic server-error text.
    if (isUpstreamGeminiFailure(e)) {
      return NextResponse.json(
        {
          error: (e as Error).message,
          userMessage: GEMINI_DOWN_MESSAGE,
          upstream: true,
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: `AI analiza nije uspjela: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  // Off-topic / non-food → hardcoded guard message, no diary side effects.
  if (!raw.isFood || raw.items.length === 0) {
    return NextResponse.json({ offTopic: true, message: OFF_TOPIC_MESSAGE });
  }

  // Off-topic is NOT refunded: the model answered and the call was paid for.
  let result;
  try {
    result = await buildAnalysisFromRaw(raw);
  } catch (e) {
    // The model answered but we failed to use it — our bug, not their credit.
    await refund();
    return NextResponse.json(
      { error: `AI analiza nije uspjela: ${(e as Error).message}` },
      { status: 500 },
    );
  }
  result.model = usedModel;
  return NextResponse.json({ result });
}
