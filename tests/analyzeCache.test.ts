import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeCacheKey,
  dedupeAnalysis,
  __resetAnalyzeCache,
  type CachedAnalysis,
} from "../lib/ai/analyzeCache";

const RESULT: CachedAnalysis = {
  model: "model-a",
  raw: {
    isFood: true,
    title: "Obrok",
    confidence: "high",
    items: [
      {
        name: "tjestenina",
        estimatedGrams: 200,
        kcalPer100g: 130,
        proteinPer100g: 5,
        carbsPer100g: 25,
        fatPer100g: 1,
      },
    ],
    kcalMin: null,
    kcalMax: null,
  },
};

const KEY = (over: Partial<Parameters<typeof analyzeCacheKey>[0]> = {}) =>
  analyzeCacheKey({ uid: "user-1", imageBase64: "AAAA", mime: "image/jpeg", ...over });

describe("analyzeCacheKey", () => {
  test("identical input for the same user produces the same key", () => {
    assert.equal(KEY(), KEY());
  });

  test("a different user never shares a cache entry", () => {
    assert.notEqual(KEY(), KEY({ uid: "user-2" }));
  });

  test("a different photo or description produces a different key", () => {
    assert.notEqual(KEY(), KEY({ imageBase64: "BBBB" }));
    assert.notEqual(KEY(), KEY({ text: "pola porcije" }));
  });

  test("the key never contains the raw image or text", () => {
    const key = KEY({ text: "tajni opis" });
    assert.match(key, /^[0-9a-f]{64}$/);
    assert.ok(!key.includes("AAAA") && !key.includes("tajni"));
  });
});

describe("dedupeAnalysis", () => {
  beforeEach(() => __resetAnalyzeCache());

  test("a repeat of identical input is served from cache — model called once", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return RESULT;
    };
    const first = await dedupeAnalysis(KEY(), fn);
    const second = await dedupeAnalysis(KEY(), fn);
    assert.equal(calls, 1);
    assert.equal(first.source, "fresh");
    assert.equal(second.source, "cache");
    assert.deepEqual(second.value, RESULT);
  });

  test("concurrent identical requests join one call", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return RESULT;
    };
    const [a, b, c] = await Promise.all([
      dedupeAnalysis(KEY(), fn),
      dedupeAnalysis(KEY(), fn),
      dedupeAnalysis(KEY(), fn),
    ]);
    assert.equal(calls, 1);
    assert.equal(a.source, "fresh");
    assert.deepEqual([b.source, c.source], ["joined", "joined"]);
  });

  test("different input still reaches the model", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return RESULT;
    };
    await dedupeAnalysis(KEY(), fn);
    await dedupeAnalysis(KEY({ imageBase64: "BBBB" }), fn);
    assert.equal(calls, 2);
  });

  test("failures are NOT cached — an outage must stay retryable", async () => {
    let calls = 0;
    const failing = async (): Promise<CachedAnalysis> => {
      calls++;
      throw new Error("503 overloaded");
    };
    await assert.rejects(() => dedupeAnalysis(KEY(), failing));
    await assert.rejects(() => dedupeAnalysis(KEY(), failing));
    assert.equal(calls, 2, "a cached failure would pin the outage in place");
  });

  test("a failed in-flight call is cleared so the next attempt runs", async () => {
    let calls = 0;
    const fn = async (): Promise<CachedAnalysis> => {
      calls++;
      if (calls === 1) throw new Error("transient");
      return RESULT;
    };
    await assert.rejects(() => dedupeAnalysis(KEY(), fn));
    const retry = await dedupeAnalysis(KEY(), fn);
    assert.equal(retry.source, "fresh");
    assert.equal(calls, 2);
  });
});
