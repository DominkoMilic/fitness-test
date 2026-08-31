import { NextResponse } from "next/server";
import { requireUser } from "@/lib/utils/requireUser";
import { getUsageSummary } from "@/lib/ai/usage";
import { costCeiling } from "@/lib/ai/costModel";

// GET /api/me/ai/usage — development-only Gemini spend summary.
//
// Reports token counters only (no prompts, no images, no key). Rolled up from
// the in-memory ring buffer in lib/ai/usage.ts, so it covers THIS server
// instance since it started.
//
// 404s in production: the numbers are per-instance and would be misleading
// under serverless fan-out.
function envNum(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;

  const summary = getUsageSummary();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";

  return NextResponse.json({
    note:
      "Token counts are EXACT (Gemini usageMetadata). Prices are the published " +
      "rates in lib/ai/usage.ts — override with GEMINI_PRICE_<MODEL>=<in>:<out>.",
    // What real traffic on this instance has actually cost.
    measured: summary,
    // What the enforced limits allow, which is a different question from what
    // traffic has averaged. See lib/ai/costModel.ts.
    ceiling: costCeiling({
      model,
      maxOutputTokens: envNum("GEMINI_MAX_OUTPUT_TOKENS", 1_100),
      globalDailyLimit: envNum("AI_GLOBAL_DAILY_LIMIT", 200),
    }),
    ceilingNote:
      "worstCasePerRequestUsd assumes max input (300-char description + " +
      "high-resolution image), output at maxOutputTokens, and thinking billed " +
      "ON TOP of that cap. maxBilledCallsPerRequest is 1 because the chain " +
      "only falls through on failures that generated nothing.",
  });
}
