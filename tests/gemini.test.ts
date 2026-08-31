import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// getConfig() reads these lazily, per call, so setting them here is enough.
process.env.GEMINI_API_KEY = "test-key";
process.env.GEMINI_MODEL = "model-a";
process.env.GEMINI_FALLBACK_MODELS = "model-b";

import { analyzeWithGemini, GeminiChainError } from "../lib/ai/gemini";

type Call = { url: string; body: Record<string, unknown> };
let calls: Call[] = [];
const realFetch = globalThis.fetch;

// Minimal well-formed generateContent response.
function okResponse(text = JSON.stringify({
  isFood: true,
  title: "Tjestenina",
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
  kcalMin: 250,
  kcalMax: 300,
})) {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: {
        promptTokenCount: 700,
        candidatesTokenCount: 90,
        totalTokenCount: 790,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function stubFetch(handler: (call: Call) => Response | Promise<Response>) {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const call: Call = {
      url: String(url),
      body: JSON.parse(String(init?.body ?? "{}")),
    };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
}

const INPUT = { imageBase64: "AAAA", mime: "image/jpeg" };

describe("analyzeWithGemini — request volume", () => {
  beforeEach(() => {
    calls = [];
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("a successful analysis makes exactly ONE Gemini call", async () => {
    stubFetch(() => okResponse());
    const { raw, model } = await analyzeWithGemini(INPUT);
    assert.equal(calls.length, 1);
    assert.equal(model, "model-a");
    assert.equal(raw.items.length, 1);
  });

  test("a 503 on the primary falls back once — 2 calls, never more", async () => {
    stubFetch((c) =>
      c.url.includes("model-a")
        ? new Response("overloaded", { status: 503 })
        : okResponse(),
    );
    const { model } = await analyzeWithGemini(INPUT);
    assert.equal(calls.length, 2);
    assert.equal(model, "model-b");
  });

  test("a TIMEOUT does not buy a second copy — chain stops at 1 call", async () => {
    // The generation is already running (and billed) on Google's side;
    // re-sending the image to another model would pay for it twice.
    stubFetch(async () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "TimeoutError";
      throw err;
    });
    await assert.rejects(() => analyzeWithGemini(INPUT), /timeout/);
    assert.equal(calls.length, 1);
  });

  test("an empty candidate stops the chain and resolves as off-topic", async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ candidates: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const { raw } = await analyzeWithGemini(INPUT);
    assert.equal(calls.length, 1);
    assert.equal(raw.isFood, false);
    assert.equal(raw.items.length, 0);
  });

  test("malformed JSON stops the chain rather than re-paying", async () => {
    stubFetch(() => okResponse("not json at all"));
    await assert.rejects(() => analyzeWithGemini(INPUT), /non-JSON output/);
    assert.equal(calls.length, 1);
  });

  test("a 401 is fatal — no fallback attempt", async () => {
    stubFetch(() => new Response("bad key", { status: 401 }));
    await assert.rejects(() => analyzeWithGemini(INPUT), /401/);
    assert.equal(calls.length, 1);
  });

  test("retries are bounded by the model list even if every model 503s", async () => {
    stubFetch(() => new Response("overloaded", { status: 503 }));
    await assert.rejects(() => analyzeWithGemini(INPUT), /All Gemini models failed/);
    assert.equal(calls.length, 2);
  });
});

describe("analyzeWithGemini — request shape", () => {
  beforeEach(() => {
    calls = [];
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("output is capped", async () => {
    stubFetch(() => okResponse());
    await analyzeWithGemini(INPUT);
    const cfg = calls[0].body.generationConfig as Record<string, unknown>;
    assert.ok(
      typeof cfg.maxOutputTokens === "number" && cfg.maxOutputTokens <= 1500,
      "maxOutputTokens must be set and modest",
    );
  });

  // Thinking tokens bill at the OUTPUT rate ($9.00/1M on gemini-3.5-flash),
  // and the parameter differs per model family. Sending the wrong one is
  // either a 400 or a silent bill for default-level reasoning.
  test("gemini-3.x gets thinkingLevel, NOT the legacy thinkingBudget", async () => {
    process.env.GEMINI_MODEL = "gemini-3.5-flash";
    process.env.GEMINI_FALLBACK_MODELS = "model-b";
    stubFetch(() => okResponse());
    await analyzeWithGemini(INPUT);
    const cfg = calls[0].body.generationConfig as Record<string, unknown>;
    // VERIFIED against Google's generateContent REST example:
    //   generationConfig.thinkingConfig.thinkingLevel
    // A flat generationConfig.thinkingLevel is silently IGNORED, which means
    // paying for default-level reasoning at the output rate.
    assert.deepEqual(cfg.thinkingConfig, { thinkingLevel: "minimal" });
    assert.equal(cfg.thinkingBudget, undefined, "legacy param must not be sent");
  });

  test("gemini-2.5 keeps the legacy thinkingBudget: 0", async () => {
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    stubFetch(() => okResponse());
    await analyzeWithGemini(INPUT);
    const cfg = calls[0].body.generationConfig as Record<string, unknown>;
    assert.deepEqual(cfg.thinkingConfig, { thinkingBudget: 0 });
  });

  test("never sends BOTH thinking parameters (documented 400)", async () => {
    for (const m of ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]) {
      process.env.GEMINI_MODEL = m;
      calls = [];
      stubFetch(() => okResponse());
      await analyzeWithGemini(INPUT);
      const cfg = calls[0].body.generationConfig as Record<string, unknown>;
      const tc = (cfg.thinkingConfig ?? {}) as Record<string, unknown>;
      assert.ok(
        !("thinkingLevel" in tc && "thinkingBudget" in tc),
        `${m} sent both thinking parameters (documented 400)`,
      );
    }
    process.env.GEMINI_MODEL = "model-a";
  });

  test("the dropped `notes` field is not requested in the schema", async () => {
    stubFetch(() => okResponse());
    await analyzeWithGemini(INPUT);
    const cfg = calls[0].body.generationConfig as Record<string, unknown>;
    const schema = cfg.responseSchema as { properties: Record<string, unknown> };
    assert.equal(schema.properties.notes, undefined);
  });

  test("the image is sent once, not duplicated across parts", async () => {
    stubFetch(() => okResponse());
    await analyzeWithGemini(INPUT);
    const contents = calls[0].body.contents as { parts: Record<string, unknown>[] }[];
    const imageParts = contents[0].parts.filter((p) => "inlineData" in p);
    assert.equal(imageParts.length, 1);
  });

  test("the system prompt stays compact", async () => {
    stubFetch(() => okResponse());
    await analyzeWithGemini(INPUT);
    const si = calls[0].body.systemInstruction as { parts: { text: string }[] };
    assert.ok(
      si.parts[0].text.length < 1000,
      `system prompt grew to ${si.parts[0].text.length} chars`,
    );
  });
});

describe("billed classification — decides whether the daily credit is refunded", () => {
  beforeEach(() => {
    calls = [];
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("a timeout is billed, so the credit is NOT refunded", async () => {
    stubFetch(async () => {
      const err = new Error("aborted");
      err.name = "TimeoutError";
      throw err;
    });
    const e = await analyzeWithGemini(INPUT).catch((x) => x);
    assert.ok(e instanceof GeminiChainError);
    assert.equal(e.billed, true);
  });

  test("an all-503 outage is not billed, so the credit IS refunded", async () => {
    stubFetch(() => new Response("overloaded", { status: 503 }));
    const e = await analyzeWithGemini(INPUT).catch((x) => x);
    assert.ok(e instanceof GeminiChainError);
    assert.equal(e.billed, false);
  });

  test("a transport failure is not billed", async () => {
    stubFetch(async () => {
      throw new Error("fetch failed");
    });
    const e = await analyzeWithGemini(INPUT).catch((x) => x);
    assert.ok(e instanceof GeminiChainError);
    assert.equal(e.billed, false);
  });

  test("malformed output is billed", async () => {
    stubFetch(() => okResponse("{{{"));
    const e = await analyzeWithGemini(INPUT).catch((x) => x);
    assert.ok(e instanceof GeminiChainError);
    assert.equal(e.billed, true);
  });
});

describe("rate limiting and truncation", () => {
  beforeEach(() => {
    calls = [];
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("429 stops the chain instead of hopping to the next model", async () => {
    stubFetch(() => new Response("quota exceeded", { status: 429 }));
    const e = await analyzeWithGemini(INPUT).catch((x) => x);
    assert.equal(calls.length, 1, "must not add load during a backoff window");
    assert.ok(e instanceof GeminiChainError);
    assert.equal(e.rateLimited, true);
    assert.equal(e.billed, false);
  });

  test("a MAX_TOKENS truncation is a real error, not a false 'off-topic'", async () => {
    // Telling the user "this assistant only handles food" when OUR output cap
    // was too low would hide a config bug behind a misleading message.
    stubFetch(
      () =>
        new Response(
          JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const e = await analyzeWithGemini(INPUT).catch((x) => x);
    assert.ok(e instanceof GeminiChainError);
    assert.match(e.message, /maxOutputTokens/);
    assert.equal(calls.length, 1);
  });

  test("a SAFETY block still resolves as off-topic", async () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({ candidates: [{ finishReason: "SAFETY" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const { raw } = await analyzeWithGemini(INPUT);
    assert.equal(raw.isFood, false);
    assert.equal(calls.length, 1);
  });
});

describe("usage telemetry can distinguish every billing outcome", () => {
  test("price table has no silent fallback for unknown models", async () => {
    const { estimateCostUsd, isPriceKnown } = await import("../lib/ai/usage");
    // A `-latest` alias hot-swaps and has no published price. It must report
    // as unknown rather than being costed at some other model's rate.
    assert.equal(isPriceKnown("gemini-flash-latest"), false);
    assert.equal(estimateCostUsd("gemini-flash-latest", 1e6, 1e6), 0);
    // Known models use the verified published rates.
    assert.equal(isPriceKnown("gemini-3.5-flash"), true);
    assert.equal(estimateCostUsd("gemini-3.5-flash", 1e6, 0), 1.5);
    assert.equal(estimateCostUsd("gemini-3.5-flash", 0, 1e6), 9.0);
    assert.equal(estimateCostUsd("gemini-3.1-flash-lite", 1e6, 0), 0.25);
  });
});

describe("model alias safety (evidenced by the Aug 2026 billing data)", () => {
  beforeEach(() => {
    calls = [];
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    process.env.GEMINI_MODEL = "model-a";
    process.env.GEMINI_FALLBACK_MODELS = "model-b";
  });

  test("a -latest alias is warned about, because its price can change silently", async () => {
    const warnings: string[] = [];
    const realWarn = console.warn;
    console.warn = (m: string) => warnings.push(String(m));
    process.env.GEMINI_MODEL = "gemini-flash-latest";
    stubFetch(() => okResponse());
    try {
      await analyzeWithGemini(INPUT);
    } finally {
      console.warn = realWarn;
    }
    assert.ok(
      warnings.some((w) => w.includes("gemini-flash-latest") && w.includes("alias")),
      "an alias primary must be flagged",
    );
  });

  test("explicit pinned ids produce no warning", async () => {
    const warnings: string[] = [];
    const realWarn = console.warn;
    console.warn = (m: string) => warnings.push(String(m));
    process.env.GEMINI_MODEL = "gemini-3.1-flash-lite";
    process.env.GEMINI_FALLBACK_MODELS = "gemini-3.5-flash";
    stubFetch(() => okResponse());
    try {
      await analyzeWithGemini(INPUT);
    } finally {
      console.warn = realWarn;
    }
    assert.equal(warnings.length, 0);
  });
});

describe("media resolution (Gemini 3 image token allocation)", () => {
  beforeEach(() => {
    calls = [];
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.GEMINI_MEDIA_RESOLUTION;
    process.env.GEMINI_MODEL = "model-a";
  });

  test("unset by default — request shape is unchanged", async () => {
    process.env.GEMINI_MODEL = "gemini-3.5-flash";
    stubFetch(() => okResponse());
    await analyzeWithGemini(INPUT);
    const cfg = calls[0].body.generationConfig as Record<string, unknown>;
    assert.equal(cfg.mediaResolution, undefined);
  });

  test("low/medium/high are passed through for gemini-3 models", async () => {
    for (const level of ["low", "medium", "high"]) {
      process.env.GEMINI_MEDIA_RESOLUTION = level;
      process.env.GEMINI_MODEL = "gemini-3.5-flash";
      calls = [];
      stubFetch(() => okResponse());
      await analyzeWithGemini(INPUT);
      const cfg = calls[0].body.generationConfig as Record<string, unknown>;
      assert.equal(cfg.mediaResolution, `MEDIA_RESOLUTION_${level.toUpperCase()}`);
    }
  });

  test("garbage values are ignored rather than sent", async () => {
    process.env.GEMINI_MEDIA_RESOLUTION = "ultra";
    process.env.GEMINI_MODEL = "gemini-3.5-flash";
    stubFetch(() => okResponse());
    await analyzeWithGemini(INPUT);
    const cfg = calls[0].body.generationConfig as Record<string, unknown>;
    assert.equal(cfg.mediaResolution, undefined);
  });

  test("not sent to non-Gemini-3 models, which would reject it", async () => {
    process.env.GEMINI_MEDIA_RESOLUTION = "low";
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    stubFetch(() => okResponse());
    await analyzeWithGemini(INPUT);
    const cfg = calls[0].body.generationConfig as Record<string, unknown>;
    assert.equal(cfg.mediaResolution, undefined);
  });
});

describe("request contract verified against Google's REST docs", () => {
  beforeEach(() => { calls = []; });
  afterEach(() => {
    globalThis.fetch = realFetch;
    process.env.GEMINI_MODEL = "model-a";
    delete process.env.GEMINI_MEDIA_RESOLUTION;
    delete process.env.GEMINI_TEMPERATURE;
  });

  test("thinkingLevel is NESTED under thinkingConfig, never flat", async () => {
    process.env.GEMINI_MODEL = "gemini-3.5-flash";
    stubFetch(() => okResponse());
    await analyzeWithGemini(INPUT);
    const cfg = calls[0].body.generationConfig as Record<string, unknown>;
    assert.equal(cfg.thinkingLevel, undefined, "flat field is ignored by the API");
    assert.deepEqual(cfg.thinkingConfig, { thinkingLevel: "minimal" });
  });

  test("mediaResolution is a flat generationConfig enum string", async () => {
    process.env.GEMINI_MODEL = "gemini-3.5-flash";
    process.env.GEMINI_MEDIA_RESOLUTION = "medium";
    stubFetch(() => okResponse());
    await analyzeWithGemini(INPUT);
    const cfg = calls[0].body.generationConfig as Record<string, unknown>;
    assert.equal(cfg.mediaResolution, "MEDIA_RESOLUTION_MEDIUM");
  });

  test("Gemini 3 uses temperature 1.0 per Google's explicit guidance", async () => {
    for (const m of ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]) {
      process.env.GEMINI_MODEL = m;
      calls = [];
      stubFetch(() => okResponse());
      await analyzeWithGemini(INPUT);
      const cfg = calls[0].body.generationConfig as Record<string, unknown>;
      assert.equal(cfg.temperature, 1.0, `${m} must use the recommended default`);
    }
  });

  test("older families keep the tuned 0.2", async () => {
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    stubFetch(() => okResponse());
    await analyzeWithGemini(INPUT);
    const cfg = calls[0].body.generationConfig as Record<string, unknown>;
    assert.equal(cfg.temperature, 0.2);
  });

  test("all three benchmark candidates produce an identical request except the model", async () => {
    const bodies: Record<string, unknown>[] = [];
    for (const m of ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]) {
      process.env.GEMINI_MODEL = m;
      calls = [];
      stubFetch(() => okResponse());
      await analyzeWithGemini(INPUT);
      bodies.push(calls[0].body);
    }
    // The benchmark is only valid if the model is the ONLY variable.
    const [a, b, c] = bodies.map((x) => JSON.stringify(x));
    assert.equal(a, b, "3.5-flash and 3.5-flash-lite request bodies must match");
    assert.equal(b, c, "3.5-flash-lite and 3.1-flash-lite request bodies must match");
  });
});

describe("Gemini 3 Lite models are configured identically to Gemini 3 Flash", () => {
  beforeEach(() => { calls = []; });
  afterEach(() => {
    globalThis.fetch = realFetch;
    process.env.GEMINI_MODEL = "model-a";
  });

  test("3.x lite DOES receive thinkingLevel (unlike 2.5 lite)", async () => {
    for (const m of ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]) {
      process.env.GEMINI_MODEL = m;
      calls = [];
      stubFetch(() => okResponse());
      await analyzeWithGemini(INPUT);
      const cfg = calls[0].body.generationConfig as Record<string, unknown>;
      assert.deepEqual(cfg.thinkingConfig, { thinkingLevel: "minimal" }, `${m}`);
    }
  });
});

describe("fallback chain excludes the benchmarked-unreliable model", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
    process.env.GEMINI_MODEL = "model-a";
    process.env.GEMINI_FALLBACK_MODELS = "model-b";
  });

  test("the default chain does not contain gemini-3.1-flash-lite", async () => {
    // Benchmarked at ~50% schema success and EOL 2027-05-07. A fallback that
    // fails half the time turns a recoverable blip into a user-visible error.
    delete process.env.GEMINI_FALLBACK_MODELS;
    process.env.GEMINI_MODEL = "gemini-3.5-flash";
    calls = [];
    stubFetch(() => new Response("down", { status: 503 }));
    await analyzeWithGemini(INPUT).catch(() => null);
    assert.ok(
      !calls.some((c) => c.url.includes("gemini-3.1-flash-lite")),
      "3.1-flash-lite (50% schema success, EOL 2027-05-07) must not be in the chain",
    );
    for (const bad of ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-2.5-flash-lite"]) {
      assert.ok(!calls.some((c) => c.url.includes(bad)), `${bad} failed the benchmark`);
    }
    assert.ok(calls.some((c) => c.url.includes("gemini-3.5-flash")));
  });
});

describe("benchmarked production defaults", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
    process.env.GEMINI_MODEL = "model-a";
    process.env.GEMINI_FALLBACK_MODELS = "model-b";
  });

  test("primary defaults to the benchmark winner, fallback to the only survivor", async () => {
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_FALLBACK_MODELS;
    calls = [];
    stubFetch(() => new Response("down", { status: 503 }));
    await analyzeWithGemini(INPUT).catch(() => null);
    assert.equal(calls.length, 2);
    assert.ok(calls[0].url.includes("gemini-3.5-flash-lite"), "primary is Lite");
    assert.ok(
      calls[1].url.includes("gemini-3.5-flash") &&
        !calls[1].url.includes("lite"),
      "fallback is full Flash",
    );
  });
});
