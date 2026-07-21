import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";
import { analyzeWithGemini } from "@/lib/ai/gemini";
import { buildAnalysisFromRaw } from "@/lib/ai/matchFood";
import { OFF_TOPIC_MESSAGE } from "@/lib/ai/guard";

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
    return NextResponse.json(
      { error: `AI analiza nije uspjela: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  // Off-topic / non-food → hardcoded guard message, no diary side effects.
  if (!raw.isFood || raw.items.length === 0) {
    return NextResponse.json({ offTopic: true, message: OFF_TOPIC_MESSAGE });
  }

  const result = await buildAnalysisFromRaw(raw);
  result.model = usedModel;
  return NextResponse.json({ result });
}
