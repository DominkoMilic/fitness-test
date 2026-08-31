import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";
import { randomUUID } from "crypto";
import { analyzeWithGemini, GeminiChainError } from "@/lib/ai/gemini";
import { analyzeCacheKey, dedupeAnalysis } from "@/lib/ai/analyzeCache";
import { recordGeminiUsage } from "@/lib/ai/usage";
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

// Hard project-wide ceiling. The per-user cap bounds one user; this bounds the
// BILL. Set AI_GLOBAL_DAILY_LIMIT to raise it.
function globalDailyLimit(): number {
  const n = Number(process.env.AI_GLOBAL_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 200;
}

// Logged once per instance so a missing migration is visible but not noisy.
let warnedNoGlobalCap = false;

// Thrown from inside the dedupe factory when a daily allowance rejects the
// request. Carries the HTTP status so the single catch below can answer.
class AllowanceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AllowanceError";
    this.status = status;
  }
}

type Body = { imageBase64?: string; mime?: string; text?: string };

export async function POST(req: Request) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  // Correlation id for this HTTP request. Passed into the Gemini chain so
  // every attempt, fallback and cache hit for one user action shares an id,
  // and returned as X-Request-Id so a log line can be tied to a click.
  const requestId = randomUUID().slice(0, 8);

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

  // ── Reservation + Gemini ──────────────────────────────────────────
  // ORDER MATTERS. Validation → cache/dedup → reserve → Gemini.
  //
  // The allowances exist to bound GENERATIONS, so only the request that
  // actually performs one may consume them. Reserving before the cache check
  // (the previous order) meant a cache hit burned a slot out of the global
  // daily budget for a call that never happened — and because the global
  // counter is deliberately non-refundable, that slot was gone for good.
  //
  // Concurrency is handled by dedupeAnalysis: for N identical simultaneous
  // requests it invokes this factory exactly once, so exactly one of them
  // reserves. The others await the same promise and reserve nothing. No
  // external lock or Redis needed — the in-flight map IS the lock, and it is
  // correct per instance, which is the scope the allowance protects anyway.
  const supa = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const refundUser = async () => {
    // Never let a refund failure mask the real error being returned.
    try {
      await supa.rpc("refund_ai_usage", { p_user_id: uid, p_date: today });
    } catch {
      /* best effort */
    }
  };

  // Set inside the factory. Tells the error paths below whether a per-user
  // credit was actually taken, so a cache hit never triggers a bogus refund.
  let reserved = false;

  const reserveAllowance = async () => {
    const { data: count, error: usageErr } = await supa.rpc("bump_ai_usage", {
      p_user_id: uid,
      p_date: today,
    });
    if (usageErr) throw new AllowanceError(usageErr.message, 500);
    reserved = true;

    const limit = dailyLimit();
    if (typeof count === "number" && count > limit) {
      throw new AllowanceError(
        `Dosegnut je dnevni limit AI analiza (${limit}). Pokušajte ponovno sutra.`,
        429,
      );
    }

    // Global circuit breaker. Counts every generation attempt and is never
    // refunded: it bounds attempts during an outage, not just money, which is
    // the point of a breaker. Degrades to "no cap" if the migration has not
    // been run, so deploy order does not matter.
    const { data: globalCount, error: globalErr } = await supa.rpc(
      "bump_global_ai_usage",
      { p_date: today },
    );
    if (globalErr) {
      if (!warnedNoGlobalCap) {
        warnedNoGlobalCap = true;
        console.warn(
          `[ai-analyze] global daily cap inactive (${globalErr.message}) — run db/migrations/2026-08-31_ai-global-daily-cap.sql`,
        );
      }
    } else if (
      typeof globalCount === "number" &&
      globalCount > globalDailyLimit()
    ) {
      throw new AllowanceError(
        "AI analiza je privremeno nedostupna (dnevni limit). Pokušajte ponovno sutra.",
        429,
      );
    }
  };

  // Warm the foods index while the model is thinking. buildAnalysisFromRaw
  // needs it, but only AFTER the model answers — loading it there put a cold
  // instance's ~1s table read in series behind the call instead of under it.
  void getFoodsIndex().catch(() => null);

  const cacheKey = analyzeCacheKey({ uid, imageBase64, mime, text });
  let raw, usedModel;
  try {
    const outcome = await dedupeAnalysis(cacheKey, async () => {
      await reserveAllowance();
      return analyzeWithGemini(
        { imageBase64, mime, text },
        { feature: "ai-meal-analyze", requestId },
      );
    });
    ({ raw, model: usedModel } = outcome.value);
    if (outcome.source !== "fresh") {
      // No Gemini call and no reservation — just record the avoided cost.
      recordGeminiUsage({
        requestId,
        feature: "ai-meal-analyze",
        model: usedModel,
        attempt: 0,
        outcome: "cache-hit",
        cacheSource: outcome.source,
        promptTokens: 0,
        outputTokens: 0,
        thoughtTokens: 0,
        totalTokens: 0,
        billedWithoutResult: false,
        durationMs: 0,
      });
    }
  } catch (e) {
    if (e instanceof AllowanceError) {
      // The per-user credit is taken before the global check, so give it back
      // when the GLOBAL cap is what rejected us.
      if (reserved && e.status === 429) await refundUser();
      return NextResponse.json(
        { error: e.message },
        { status: e.status, headers: { "X-Request-Id": requestId } },
      );
    }
    // Refund only what Google did not charge us for, and only if we reserved.
    if (reserved && (!(e instanceof GeminiChainError) || !e.billed)) {
      await refundUser();
    }
    if (e instanceof GeminiChainError && e.rateLimited) {
      return NextResponse.json(
        {
          error: (e as Error).message,
          userMessage:
            "Previše zahtjeva prema AI servisu u kratkom vremenu. Pričekajte minutu pa pokušajte ponovno.",
          upstream: true,
        },
        { status: 429, headers: { "X-Request-Id": requestId } },
      );
    }
    if (isUpstreamGeminiFailure(e)) {
      return NextResponse.json(
        {
          error: (e as Error).message,
          userMessage: GEMINI_DOWN_MESSAGE,
          upstream: true,
        },
        { status: 503, headers: { "X-Request-Id": requestId } },
      );
    }
    return NextResponse.json(
      { error: `AI analiza nije uspjela: ${(e as Error).message}` },
      { status: 502, headers: { "X-Request-Id": requestId } },
    );
  }

  // Off-topic / non-food → hardcoded guard message, no diary side effects.
  if (!raw.isFood || raw.items.length === 0) {
    return NextResponse.json(
      { offTopic: true, message: OFF_TOPIC_MESSAGE },
      { headers: { "X-Request-Id": requestId } },
    );
  }

  // Off-topic is NOT refunded: the model answered and the call was paid for.
  let result;
  try {
    result = await buildAnalysisFromRaw(raw);
  } catch (e) {
    // The model answered but we failed to use it — our bug, not their credit.
    if (reserved) await refundUser();
    return NextResponse.json(
      { error: `AI analiza nije uspjela: ${(e as Error).message}` },
      { status: 500 },
    );
  }
  result.model = usedModel;
  return NextResponse.json({ result }, { headers: { "X-Request-Id": requestId } });
}
