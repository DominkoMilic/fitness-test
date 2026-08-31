import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { costCeiling, IMAGE_TOKENS } from "../lib/ai/costModel";
import { dedupeAnalysis, __resetAnalyzeCache } from "../lib/ai/analyzeCache";
import type { CachedAnalysis } from "../lib/ai/analyzeCache";

describe("cost ceiling is a ceiling, not an average", () => {
  const base = {
    model: "gemini-3.5-flash",
    maxOutputTokens: 1100,
    globalDailyLimit: 200,
  };

  test("worst case per request exceeds the measured average", () => {
    const c = costCeiling(base);
    // Measured average on real traffic was ~$0.0065-0.0097. The ceiling must
    // be strictly above that or it is not bounding anything.
    assert.ok(
      c.worstCasePerRequestUsd > 0.0097,
      `ceiling ${c.worstCasePerRequestUsd} must exceed the measured average`,
    );
  });

  test("only ONE generation can be billed per request", () => {
    // The chain falls through only for failures that generated nothing, so a
    // single user action cannot be charged for two generations.
    assert.equal(costCeiling(base).maxBilledCallsPerRequest, 1);
  });

  test("worst-case daily is per-request x the global cap", () => {
    const c = costCeiling(base);
    assert.equal(
      Number(c.worstCaseDailyUsd.toFixed(6)),
      Number((c.worstCasePerRequestUsd * 200).toFixed(6)),
    );
  });

  test("assumes the full image allocation and the full text limit", () => {
    const c = costCeiling(base);
    assert.ok(c.maxInputTokens > IMAGE_TOKENS.high, "must include the prompt");
    // 300-char description at a conservative 2.5 chars/token.
    assert.ok(c.maxInputTokens >= IMAGE_TOKENS.high + 226 + 169 + 120);
  });

  test("assumes thinking is billed ON TOP of maxOutputTokens", () => {
    // Google does not clearly document whether thinking counts against the
    // cap, so the ceiling must take the pessimistic reading.
    assert.ok(costCeiling(base).maxOutputTokens >= 1100 * 2);
  });

  test("a cheaper model lowers the ceiling proportionally", () => {
    const flash = costCeiling(base);
    const lite = costCeiling({ ...base, model: "gemini-3.1-flash-lite" });
    assert.ok(lite.worstCaseDailyUsd < flash.worstCaseDailyUsd / 4);
  });

  test("an unpriced model is flagged rather than costed at zero silently", () => {
    const c = costCeiling({ ...base, model: "gemini-flash-latest" });
    assert.equal(c.priceKnown, false);
  });

  test("lower media resolution lowers the ceiling", () => {
    const high = costCeiling({ ...base, imageTokens: IMAGE_TOKENS.high });
    const low = costCeiling({ ...base, imageTokens: IMAGE_TOKENS.low });
    assert.ok(low.worstCasePerRequestUsd < high.worstCasePerRequestUsd);
  });
});

describe("allowance is reserved only by the request that owns the generation", () => {
  const RESULT: CachedAnalysis = {
    model: "m",
    raw: {
      isFood: true,
      title: "t",
      confidence: "high",
      items: [
        {
          name: "x",
          estimatedGrams: 1,
          kcalPer100g: 1,
          proteinPer100g: 1,
          carbsPer100g: 1,
          fatPer100g: 1,
        },
      ],
      kcalMin: null,
      kcalMax: null,
    },
  };

  test("a cache hit does NOT run the reserve+generate factory", async () => {
    __resetAnalyzeCache();
    let reservations = 0;
    const factory = async () => {
      reservations++; // stands in for bump_ai_usage + bump_global_ai_usage
      return RESULT;
    };
    await dedupeAnalysis("k", factory);
    await dedupeAnalysis("k", factory);
    await dedupeAnalysis("k", factory);
    assert.equal(
      reservations,
      1,
      "cache hits must not consume the global generation budget",
    );
  });

  test("concurrent identical requests reserve exactly once", async () => {
    __resetAnalyzeCache();
    let reservations = 0;
    const factory = async () => {
      reservations++;
      await new Promise((r) => setTimeout(r, 20));
      return RESULT;
    };
    const out = await Promise.all([
      dedupeAnalysis("k2", factory),
      dedupeAnalysis("k2", factory),
      dedupeAnalysis("k2", factory),
      dedupeAnalysis("k2", factory),
    ]);
    assert.equal(reservations, 1);
    assert.equal(out.filter((o) => o.source === "fresh").length, 1);
    assert.equal(out.filter((o) => o.source === "joined").length, 3);
  });

  test("a rejected allowance is not cached, so the next request retries", async () => {
    __resetAnalyzeCache();
    let attempts = 0;
    const factory = async (): Promise<CachedAnalysis> => {
      attempts++;
      throw new Error("daily limit reached");
    };
    await assert.rejects(() => dedupeAnalysis("k3", factory));
    await assert.rejects(() => dedupeAnalysis("k3", factory));
    assert.equal(attempts, 2);
  });
});
