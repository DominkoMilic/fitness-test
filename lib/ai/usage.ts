import "server-only";

// Gemini usage/cost observability.
//
// Every generateContent response carries a `usageMetadata` block with the
// EXACT billed token counts. It costs nothing extra and we were throwing it
// away, which is why nobody could tell which feature was spending money.
// This module records one entry per model attempt (including the attempts
// that failed, since a timed-out generation is still billed) and can roll
// them up for a development-only summary.
//
// Privacy: token COUNTS only. No prompt text, no image bytes, no user id, no
// API key ever reaches this module.

export type GeminiUsageEntry = {
  requestId: string;
  feature: string;
  model: string;
  attempt: number;
  // "ok"          = Gemini answered and we used it (BILLED)
  // "error"       = attempt failed; see billedWithoutResult for whether it cost
  // "cache-hit"   = no Gemini call happened at all (FREE)
  outcome: "ok" | "error" | "cache-hit";
  // For cache-hits: "cache" = served from the result cache, "joined" = an
  // identical request was already in flight and this one waited for it.
  cacheSource?: "cache" | "joined";
  // From usageMetadata. Null when the response never arrived (transport
  // failure / timeout) and Google therefore told us nothing about the cost.
  promptTokens: number | null;
  outputTokens: number | null;
  thoughtTokens: number | null;
  totalTokens: number | null;
  // True when the attempt very likely consumed generation capacity even
  // though we did not get a usable answer (timeout, malformed output).
  billedWithoutResult: boolean;
  durationMs: number;
  error?: string;
};

// Ring buffer. Bounded so a long-running instance can never grow unbounded.
const MAX_ENTRIES = 500;
const entries: GeminiUsageEntry[] = [];

// USD per 1M tokens, paid tier, verified against Google's published pricing
// (ai.google.dev/gemini-api/docs/pricing) on 2026-08-31. Output prices are
// documented as INCLUDING thinking tokens.
//
// Note the spread: gemini-3.5-flash costs 6x the input and 6x the output of
// gemini-3.1-flash-lite. "Flash" is not a synonym for cheap in the 3.x family.
//
// The `-latest` aliases are deliberately absent: they hot-swap to whatever
// Google points them at, so their price is unknowable in advance. Requests on
// an alias are reported with a zero cost estimate and a `priceUnknown` flag
// rather than a guess — see estimateCostUsd.
//
// Override per deployment with GEMINI_PRICE_<MODEL>=<inPerM>:<outPerM>
// (dots/dashes → underscores), e.g. GEMINI_PRICE_GEMINI_3_5_FLASH=1.50:9.00
const DEFAULT_PRICES: Record<string, { in: number; out: number }> = {
  "gemini-3.5-flash": { in: 1.5, out: 9.0 },
  // Google's named replacement for gemini-3.1-flash-lite (shutdown 2027-05-07).
  "gemini-3.5-flash-lite": { in: 0.3, out: 2.5 },
  "gemini-3.1-flash-lite": { in: 0.25, out: 1.5 },
  "gemini-2.5-flash": { in: 0.3, out: 2.5 },
};

function priceFor(model: string): { in: number; out: number } | null {
  const envKey = `GEMINI_PRICE_${model.toUpperCase().replace(/[.-]/g, "_")}`;
  const raw = process.env[envKey]?.trim();
  if (raw) {
    const [i, o] = raw.split(":").map(Number);
    if (Number.isFinite(i) && Number.isFinite(o)) return { in: i, out: o };
  }
  // No silent fallback price. An unknown model (notably a `-latest` alias)
  // reports null so the summary can say "price unknown" instead of quietly
  // under-reporting spend — which is exactly how this audit started.
  return DEFAULT_PRICES[model] ?? null;
}

export function isPriceKnown(model: string): boolean {
  return priceFor(model) !== null;
}

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = priceFor(model);
  if (!p) return 0;
  return (inputTokens / 1e6) * p.in + (outputTokens / 1e6) * p.out;
}

export function recordGeminiUsage(entry: GeminiUsageEntry) {
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);

  // One structured line per attempt. Greppable in Vercel logs; safe to keep
  // on in production because it contains no content, only counters.
  const cost = estimateCostUsd(
    entry.model,
    entry.promptTokens ?? 0,
    entry.outputTokens ?? 0,
  );
  console.log(
    `[gemini-usage] ${JSON.stringify({
      id: entry.requestId,
      feature: entry.feature,
      model: entry.model,
      attempt: entry.attempt,
      outcome: entry.outcome,
      // attempt > 1 means this was a fallback model, not the primary.
      fallback: entry.attempt > 1 ? true : undefined,
      via: entry.cacheSource,
      in: entry.promptTokens,
      out: entry.outputTokens,
      thoughts: entry.thoughtTokens,
      total: entry.totalTokens,
      ms: entry.durationMs,
      billedNoResult: entry.billedWithoutResult || undefined,
      estUsd: Number(cost.toFixed(6)),
      priceUnknown: isPriceKnown(entry.model) ? undefined : true,
      err: entry.error,
    })}`,
  );
}

function stats(values: number[]) {
  if (values.length === 0) return { avg: 0, median: 0, max: 0, samples: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return {
    avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    median:
      sorted.length % 2 === 0
        ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
        : sorted[mid],
    max: sorted[sorted.length - 1],
    samples: sorted.length,
  };
}

export type UsageSummaryRow = {
  feature: string;
  model: string;
  requests: number;
  failed: number;
  cacheHits: number;
  billedWithoutResult: number;
  inputTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  totalTokens: number;
  estCostUsd: number;
  // True when this model has no published price in DEFAULT_PRICES (e.g. a
  // `-latest` alias). estCostUsd is then 0 and UNDERSTATES real spend.
  priceUnknown: boolean;
  // MEASURED per-successful-request cost. This is an average of real traffic,
  // NOT a ceiling — see lib/ai/costModel.ts for the enforced worst case.
  measuredAvgCostUsd: number;
  // Actual thinking tokens observed. `thinkingLevel: "minimal"` reduces but
  // does not guarantee zero, so judge against these, not against 0.
  thoughts: { avg: number; median: number; max: number; samples: number };
};

// Roll the ring buffer up per feature+model. Used by the dev-only
// /api/me/ai/usage endpoint.
export function getUsageSummary(): {
  rows: UsageSummaryRow[];
  totals: { requests: number; totalTokens: number; estCostUsd: number };
  since: string | null;
} {
  const byKey = new Map<string, UsageSummaryRow>();
  // Thinking tokens are only meaningful for attempts that actually returned a
  // usable response; failures report null and would skew the stats to zero.
  const thoughtSamples = new Map<string, number[]>();
  const okCounts = new Map<string, number>();
  for (const e of entries) {
    const key = `${e.feature}::${e.model}`;
    let row = byKey.get(key);
    if (!row) {
      row = {
        feature: e.feature,
        model: e.model,
        requests: 0,
        failed: 0,
        cacheHits: 0,
        billedWithoutResult: 0,
        inputTokens: 0,
        outputTokens: 0,
        thoughtTokens: 0,
        totalTokens: 0,
        estCostUsd: 0,
        priceUnknown: !isPriceKnown(e.model),
        measuredAvgCostUsd: 0,
        thoughts: { avg: 0, median: 0, max: 0, samples: 0 },
      };
      byKey.set(key, row);
    }
    row.requests += 1;
    if (e.outcome === "error") row.failed += 1;
    if (e.outcome === "cache-hit") row.cacheHits += 1;
    if (e.billedWithoutResult) row.billedWithoutResult += 1;
    row.inputTokens += e.promptTokens ?? 0;
    row.outputTokens += e.outputTokens ?? 0;
    row.thoughtTokens += e.thoughtTokens ?? 0;
    row.totalTokens += e.totalTokens ?? 0;
    row.estCostUsd += estimateCostUsd(
      e.model,
      e.promptTokens ?? 0,
      e.outputTokens ?? 0,
    );
    if (e.outcome === "ok") {
      okCounts.set(key, (okCounts.get(key) ?? 0) + 1);
      if (e.thoughtTokens != null) {
        const arr = thoughtSamples.get(key) ?? [];
        arr.push(e.thoughtTokens);
        thoughtSamples.set(key, arr);
      }
    }
  }

  for (const [key, row] of byKey) {
    row.thoughts = stats(thoughtSamples.get(key) ?? []);
    const ok = okCounts.get(key) ?? 0;
    row.measuredAvgCostUsd = ok > 0 ? row.estCostUsd / ok : 0;
  }
  const rows = [...byKey.values()].sort((a, b) => b.estCostUsd - a.estCostUsd);
  return {
    rows,
    totals: {
      requests: entries.length,
      totalTokens: rows.reduce((s, r) => s + r.totalTokens, 0),
      estCostUsd: rows.reduce((s, r) => s + r.estCostUsd, 0),
    },
    since: entries.length > 0 ? "process start (in-memory, per instance)" : null,
  };
}
