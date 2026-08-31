import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

process.env.GEMINI_API_KEY = "test-key";
process.env.GEMINI_MODEL = "gemini-3.5-flash";
process.env.GEMINI_FALLBACK_MODELS = "gemini-3.5-flash-lite";

import { analyzeWithGemini, GeminiChainError } from "../lib/ai/gemini";
import { dedupeAnalysis, __resetAnalyzeCache } from "../lib/ai/analyzeCache";
import type { CachedAnalysis } from "../lib/ai/analyzeCache";

// Item 9 of the benchmark brief, verified WITHOUT live calls: every assertion
// counts stubbed fetches, so "how many generations would Google bill" is
// checked directly rather than inferred.

let calls: string[] = [];
const realFetch = globalThis.fetch;

function ok() {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        isFood: true, title: "t", confidence: "high",
        items: [{ name: "x", estimatedGrams: 1, kcalPer100g: 1, proteinPer100g: 1, carbsPer100g: 1, fatPer100g: 1 }],
        kcalMin: null, kcalMax: null,
      }) }] } }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
function stub(h: (url: string) => Response | Promise<Response>) {
  globalThis.fetch = (async (u: string | URL | Request) => {
    calls.push(String(u));
    return h(String(u));
  }) as typeof fetch;
}
const INPUT = { imageBase64: "AAAA", mime: "image/jpeg" };

describe("no retry multiplication — billed generations per user click", () => {
  beforeEach(() => { calls = []; });
  afterEach(() => { globalThis.fetch = realFetch; });

  test("MAX BILLED GENERATIONS PER CLICK IS 1 across every failure mode", async () => {
    // Each mode that CONSUMES generation must terminate the chain. If any of
    // these ever produces 2 fetches, one user click is billed twice.
    const billedModes: [string, () => Response | Promise<Response>][] = [
      ["timeout", async () => { const e = new Error("t"); e.name = "TimeoutError"; throw e; }],
      ["empty candidate", () => new Response(JSON.stringify({ candidates: [] }), { status: 200, headers: { "Content-Type": "application/json" } })],
      ["malformed json", () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{{{" }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } })],
      ["max tokens", () => new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS" }] }), { status: 200, headers: { "Content-Type": "application/json" } })],
    ];
    for (const [name, handler] of billedModes) {
      calls = [];
      stub(handler);
      await analyzeWithGemini(INPUT).catch(() => null);
      assert.equal(calls.length, 1, `${name} must not trigger a second billed call`);
    }
  });

  test("only genuinely UNBILLED failures may fall back", async () => {
    for (const status of [400, 404, 503]) {
      calls = [];
      stub((u) => (u.includes("gemini-3.5-flash-lite") ? ok() : new Response("x", { status })));
      await analyzeWithGemini(INPUT).catch(() => null);
      assert.equal(calls.length, 2, `HTTP ${status} generated nothing, so falling back is free`);
    }
  });

  test("429 does NOT fall back — it backs off", async () => {
    stub(() => new Response("quota", { status: 429 }));
    const e = await analyzeWithGemini(INPUT).catch((x) => x);
    assert.equal(calls.length, 1);
    assert.equal((e as GeminiChainError).rateLimited, true);
    assert.equal((e as GeminiChainError).billed, false, "429 is not billed → credit refundable");
  });

  test("401/403 are fatal — no fallback", async () => {
    for (const status of [401, 403]) {
      calls = [];
      stub(() => new Response("bad key", { status }));
      await analyzeWithGemini(INPUT).catch(() => null);
      assert.equal(calls.length, 1);
    }
  });

  test("total fetches can never exceed the configured chain length", async () => {
    stub(() => new Response("down", { status: 503 }));
    await analyzeWithGemini(INPUT).catch(() => null);
    assert.equal(calls.length, 2, "2 models configured → hard ceiling of 2 attempts");
  });

  test("billed classification decides the refund correctly", async () => {
    stub(async () => { const e = new Error("t"); e.name = "TimeoutError"; throw e; });
    assert.equal(((await analyzeWithGemini(INPUT).catch((x) => x)) as GeminiChainError).billed, true);
    calls = [];
    stub(() => new Response("down", { status: 503 }));
    assert.equal(((await analyzeWithGemini(INPUT).catch((x) => x)) as GeminiChainError).billed, false);
  });
});

describe("cache still prevents identical repeat generations", () => {
  const R: CachedAnalysis = {
    model: "m",
    raw: { isFood: true, title: "t", confidence: "high", items: [{ name: "x", estimatedGrams: 1, kcalPer100g: 1, proteinPer100g: 1, carbsPer100g: 1, fatPer100g: 1 }], kcalMin: null, kcalMax: null },
  };

  test("a repeat of identical input runs no generation and no reservation", async () => {
    __resetAnalyzeCache();
    let generations = 0;
    const f = async () => { generations++; return R; };
    await dedupeAnalysis("k", f);
    await dedupeAnalysis("k", f);
    assert.equal(generations, 1);
  });

  test("an outage is never cached, so recovery is immediate", async () => {
    __resetAnalyzeCache();
    let n = 0;
    const failing = async (): Promise<CachedAnalysis> => { n++; throw new Error("503"); };
    await assert.rejects(() => dedupeAnalysis("k2", failing));
    await assert.rejects(() => dedupeAnalysis("k2", failing));
    assert.equal(n, 2);
  });
});
