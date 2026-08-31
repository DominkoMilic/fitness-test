import "server-only";
import { createHash } from "crypto";
import type { GeminiRaw } from "./gemini";

// In-flight de-duplication + a short result cache for meal analysis.
//
// Two real spend patterns this removes:
//   1. The same photo analysed twice in a row. The error screen offers
//      "Natrag", which drops the user back on the input step with the photo
//      still attached — one tap re-sends BYTE-IDENTICAL input. Retrying after
//      a Gemini outage is exactly the behaviour we want, but once the outage
//      clears the second identical attempt should not be a second charge.
//   2. Two concurrent requests for the same input (double tap that beats the
//      client guard, a reconnecting mobile browser replaying the POST).
//      Without dedup both reach Gemini; with it the second awaits the first.
//
// Cached value is the RAW model output only — small, and never the image.
// Keys are salted with the user id so one user's cache can never serve
// another's request, even in the (practically impossible) event of an
// identical input hash.
//
// Correctness: the model is called at temperature 0.2 on fixed input, so a
// hit returns what a fresh call would have returned modulo sampling noise.
// `foods`-table nutrition is NOT cached here — buildAnalysisFromRaw still runs
// per request, so a sheet-sync that changes nutrition is reflected immediately.

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 50;

export type CachedAnalysis = { raw: GeminiRaw; model: string };

type Entry = { value: CachedAnalysis; expires: number };

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<CachedAnalysis>>();

export function analyzeCacheKey(input: {
  uid: string;
  imageBase64?: string;
  mime?: string;
  text?: string;
}): string {
  return createHash("sha256")
    .update(input.uid)
    .update("\0")
    .update(input.mime ?? "")
    .update("\0")
    .update(input.text ?? "")
    .update("\0")
    .update(input.imageBase64 ?? "")
    .digest("hex");
}

// Map insertion order is oldest-first, so the first key is the eviction
// candidate. Expired entries are dropped on read; this bounds the rest.
function evictIfNeeded() {
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

function readAnalysisCache(key: string): CachedAnalysis | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function writeAnalysisCache(key: string, value: CachedAnalysis) {
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  evictIfNeeded();
}

export type DedupeOutcome =
  | { source: "fresh"; value: CachedAnalysis }
  | { source: "cache"; value: CachedAnalysis }
  | { source: "joined"; value: CachedAnalysis };

/**
 * Run `fn` for `key`, reusing a cached result or joining an identical request
 * that is already running. Only successful results are cached — a failure
 * must stay retryable, and caching one would pin an outage in place.
 */
export async function dedupeAnalysis(
  key: string,
  fn: () => Promise<CachedAnalysis>,
): Promise<DedupeOutcome> {
  const cached = readAnalysisCache(key);
  if (cached) return { source: "cache", value: cached };

  const running = inFlight.get(key);
  if (running) return { source: "joined", value: await running };

  const promise = fn()
    .then((value) => {
      writeAnalysisCache(key, value);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return { source: "fresh", value: await promise };
}

// Test seam. Not used by the app.
export function __resetAnalyzeCache() {
  cache.clear();
  inFlight.clear();
}
