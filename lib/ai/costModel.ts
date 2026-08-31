import "server-only";
import { estimateCostUsd, isPriceKnown } from "./usage";

// Cost ceilings for the analyze endpoint, derived from the limits actually
// enforced in code rather than from observed averages.
//
// The distinction this module exists to make:
//   • MEASURED  — what real traffic has cost (from Gemini's usageMetadata).
//   • TYPICAL   — what one ordinary analysis costs.
//   • WORST PER REQUEST — the most a single request can cost given the caps.
//   • WORST PER DAY     — worst-per-request x the global daily cap.
// Quoting a measured average as a "ceiling" understates the ceiling, which is
// the mistake this replaces.

// ── Input ceiling ─────────────────────────────────────────────────────
// Image: Gemini 3 allocates a fixed budget per media resolution level and the
// default ("unspecified") is 1120 tokens — the same as `high`. Pixel size does
// not change it, so this is a hard number, not an estimate.
export const IMAGE_TOKENS = { low: 280, medium: 560, high: 1120 } as const;
const IMAGE_TOKENS_DEFAULT = IMAGE_TOKENS.high;

// System prompt + responseSchema are fixed strings we control.
const SYSTEM_PROMPT_TOKENS = 226;
const SCHEMA_TOKENS = 169;
// MAX_TEXT is 300 chars in the route. Croatian tokenizes at roughly 3 chars
// per token, and we round DOWN the divisor to stay conservative.
const MAX_USER_TEXT_TOKENS = Math.ceil(300 / 2.5);
const NUDGE_TOKENS = 10;

function maxInputTokens(imageTokens: number): number {
  return (
    imageTokens +
    SYSTEM_PROMPT_TOKENS +
    SCHEMA_TOKENS +
    MAX_USER_TEXT_TOKENS +
    NUDGE_TOKENS
  );
}

// ── Output ceiling ────────────────────────────────────────────────────
// maxOutputTokens is enforced per request. Google documents thinking tokens as
// billed at the output rate, but does NOT clearly document whether they count
// against maxOutputTokens. We therefore assume the pessimistic reading — that
// thinking is billed ON TOP of the cap — so the ceiling cannot be exceeded by
// a documentation surprise.
const THINKING_HEADROOM_MULTIPLIER = 1;

export type CostCeiling = {
  model: string;
  priceKnown: boolean;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxBilledCallsPerRequest: number;
  worstCasePerRequestUsd: number;
  globalDailyLimit: number;
  worstCaseDailyUsd: number;
};

/**
 * Worst case a single analyze request can cost.
 *
 * Billed calls per request is 1, not 2: the chain only falls through to a
 * second model for failures that generated nothing (503/404/400/transport).
 * Every failure mode that DOES consume generation (timeout, empty candidate,
 * malformed output) is non-retryable and ends the chain. See lib/ai/gemini.ts.
 */
export function costCeiling(opts: {
  model: string;
  maxOutputTokens: number;
  globalDailyLimit: number;
  imageTokens?: number;
}): CostCeiling {
  const imageTokens = opts.imageTokens ?? IMAGE_TOKENS_DEFAULT;
  const inTok = maxInputTokens(imageTokens);
  const outTok = opts.maxOutputTokens * (1 + THINKING_HEADROOM_MULTIPLIER);
  const maxBilledCallsPerRequest = 1;
  const perRequest =
    estimateCostUsd(opts.model, inTok, outTok) * maxBilledCallsPerRequest;
  return {
    model: opts.model,
    priceKnown: isPriceKnown(opts.model),
    maxInputTokens: inTok,
    maxOutputTokens: outTok,
    maxBilledCallsPerRequest,
    worstCasePerRequestUsd: perRequest,
    globalDailyLimit: opts.globalDailyLimit,
    worstCaseDailyUsd: perRequest * opts.globalDailyLimit,
  };
}
