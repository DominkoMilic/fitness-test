import "server-only";
import { randomUUID } from "crypto";
import type { AiConfidence } from "@/types/app";
import { recordGeminiUsage } from "./usage";

// Server-only Gemini Vision client. Raw fetch against the REST API — no SDK,
// matching the app's style (see lib/api/openFoodFacts.ts). The API key stays
// server-side; this module must never be imported from a client component.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Per-model ceiling, and a budget for the whole fallback chain. Both MUST stay
// under the platform's function limit, or it kills the request first and the
// user gets an opaque platform error instead of our message — a timeout above
// the function budget can never fire.
//
// COST NOTE: aborting our fetch does NOT stop Google's generation, and a
// generation that started is billed whether or not we wait for it. So the
// timeout is deliberately generous relative to the ~2.4s measured p50: giving
// up early does not save money, it just means we pay for an answer we threw
// away. A timeout now ENDS the chain (see `billed` below) rather than buying
// a second copy of the same answer from another model.
//
// Vercel Hobby caps functions at 10s regardless of `maxDuration`; on Pro
// (`maxDuration = 30`) raise both via env:
//   GEMINI_TIMEOUT_MS=12000  GEMINI_CHAIN_DEADLINE_MS=20000
function envMs(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
const REQUEST_TIMEOUT_MS = envMs("GEMINI_TIMEOUT_MS", 8_000);
const CHAIN_DEADLINE_MS = envMs("GEMINI_CHAIN_DEADLINE_MS", 9_000);

// Hard ceiling on generated tokens. Output is billed several times higher than
// input, and the schema below is the only thing that was bounding the response
// — a schema-following stall could previously run to the model default (many
// thousands of tokens). 20 items × ~40 tokens of JSON each, plus the envelope,
// fits comfortably; the analyses route caps storage at 30 items anyway.
const MAX_OUTPUT_TOKENS = envMs("GEMINI_MAX_OUTPUT_TOKENS", 1_100);

// ── Image media resolution (Gemini 3 only) ────────────────────────────
//
// Gemini 3 allocates a FIXED image token budget per level, independent of the
// pixel dimensions you upload:
//     low ~280 · medium ~560 · high ~1120 tokens
// When unset the model uses "unspecified", which allocates 1120 — the same as
// high. That is what this app has always paid.
//
// This is the real image-cost lever, and it is why downscaling never helped:
// the allocation is a config value, not a function of the image size.
//
// Left UNSET by default on purpose. Changing it changes how much of the photo
// the model can actually see, which is a recognition-quality decision on this
// app's core feature, not a knob to flip silently. Set GEMINI_MEDIA_RESOLUTION
// to low | medium | high to try one, and compare with scripts/ai-model-compare.
//
// ⚠️ The exact REST spelling for the global generationConfig form is not
// documented on the pages reachable from here (Google documents the per-part
// form for the Interactions API). If setting this returns a 400, unset it —
// the app then behaves exactly as it does today.
// Google, on the Gemini 3 generateContent guide: "For all Gemini 3 models, we
// strongly recommend keeping the temperature parameter at its default value of
// 1.0." Lower values are documented to cause looping/degradation on this
// family. This app inherited 0.2 from the Gemini 2.5 era, so Gemini 3 models
// were running against explicit guidance — a plausible quality drag that would
// also have confounded any model benchmark. Older families keep 0.2.
function temperatureFor(model: string): number {
  const env = Number(process.env.GEMINI_TEMPERATURE);
  if (Number.isFinite(env) && env >= 0) return env;
  return /gemini-[12]\./.test(model) ? 0.2 : 1.0;
}

const MEDIA_RESOLUTION_VALUES = new Set(["low", "medium", "high"]);
function mediaResolutionConfig(model: string): Record<string, unknown> {
  const v = process.env.GEMINI_MEDIA_RESOLUTION?.trim().toLowerCase();
  if (!v || !MEDIA_RESOLUTION_VALUES.has(v)) return {};
  // Per Google, per-item media resolution is exclusive to Gemini 3 models;
  // sending it to an older family risks a 400 for no benefit.
  if (!/gemini-3/.test(model)) return {};
  return { mediaResolution: `MEDIA_RESOLUTION_${v.toUpperCase()}` };
}

// Per-item estimate straight from the model, per-100g. Nutrition may later be
// overridden by our own DB when the name matches a `foods` row (see matchFood).
export type GeminiRawItem = {
  name: string;
  estimatedGrams: number;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

export type GeminiRaw = {
  isFood: boolean;
  title: string;
  confidence: AiConfidence;
  items: GeminiRawItem[];
  kcalMin: number | null;
  kcalMax: number | null;
};

export type GeminiInput = {
  // base64 (no data: prefix) + mime, when a photo is provided.
  imageBase64?: string;
  mime?: string;
  // Free text: food name + details, when there's no photo (or in addition).
  text?: string;
};

// Compressed from the original ~400-token version. Every rule that changed
// model behaviour is kept; what went are the restatements and the second
// worked example, which the first already demonstrates. The schema itself
// (sent separately as responseSchema) already specifies the output shape, so
// the prompt no longer repeats it.
const SYSTEM_PROMPT = `Procjenjuješ nutritivne vrijednosti hrane iz slike i/ili kratkog opisa. Ništa drugo.

- Nije hrana ili nevezano pitanje → "isFood": false, prazan "items". Ne odgovaraj na takva pitanja.
- Razdvoji jelo na POJEDINAČNE namirnice, svaka je zasebna stavka. Npr. "tjestenina s umakom od rajčice uz čašu vina" → "tjestenina", "umak od rajčice", "bijelo vino".
- Naziv stavke: kratak, generički, hrvatski (npr. "tjestenina", ne "tjestenina s umakom"); uspoređuje se s bazom. Pripremu navedi samo ako mijenja vrijednosti ("kuhana tjestenina").
- Procijeni gramažu i vrijednosti na 100 g. Za složena jela ispuni "kcalMin"/"kcalMax".
- Vrijednosti su procjena; bez lažne preciznosti. Nejasna slika ili štur opis → "confidence": "low".`;

// Gemini responseSchema (OpenAPI subset) — forces structured JSON output.
//
// `notes` used to be here. It was the only free-form (unbounded) string the
// model produced, it was generated on 100% of calls, and NO component ever
// rendered it — the field was plumbed through matchFood into types/app.ts and
// dropped. Removing it removes pure waste at output pricing.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    isFood: { type: "BOOLEAN" },
    title: { type: "STRING" },
    confidence: { type: "STRING", enum: ["low", "medium", "high"] },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          estimatedGrams: { type: "NUMBER" },
          kcalPer100g: { type: "NUMBER" },
          proteinPer100g: { type: "NUMBER" },
          carbsPer100g: { type: "NUMBER" },
          fatPer100g: { type: "NUMBER" },
        },
        required: [
          "name",
          "estimatedGrams",
          "kcalPer100g",
          "proteinPer100g",
          "carbsPer100g",
          "fatPer100g",
        ],
      },
    },
    kcalMin: { type: "NUMBER", nullable: true },
    kcalMax: { type: "NUMBER", nullable: true },
  },
  required: ["isFood", "title", "confidence", "items"],
} as const;

// Model chain, chosen by measured benchmark on 12 meal photos (2026-08-31).
// Explicit pinned ids only — never a `-latest` alias, which hot-swaps the model
// and its price without a deploy. See benchmark/README.md.
//
// PRIMARY gemini-3.5-flash-lite — 100% schema success, 1.8s median (2.5s p95),
//   $0.00129/analysis, and the BEST downstream result: 52% of its items matched
//   a real `foods` row vs 40% for gemini-3.5-flash. It emits the short generic
//   names the system prompt asks for ("goveđa pljeskavica"), which is what
//   matchFood can actually resolve; 3.5-flash writes prose ("pohana piletina
//   pržena u dubokom ulju") that fails the matcher, so its slightly better raw
//   recognition is thrown away before the user sees it.
//
// FALLBACK gemini-3.5-flash — the ONLY other model that survived the bench.
//   Costs 3.5x more and is 2.6x slower, which is acceptable precisely because
//   it is almost never reached: the primary answered 12/12, so the fallback
//   only fires on an upstream 503/404/400, none of which are billed.
//
// Rejected, with evidence:
//   gemini-3.1-flash-lite  50% schema success (58% at temp 0.2 AND at
//                          maxOutputTokens 4000 — the model, not our config).
//                          Also EOL 2027-05-07. Was the fallback until today.
//   gemini-3.6-flash       33% schema success: 6/12 timed out at 12s.
//   gemini-3.7-flash       rejects thinkingLevel "minimal" outright (400); at
//                          "low" it returned 503 on 11/12 — no capacity.
//   gemini-2.5-flash-lite  404 "no longer available to new users", Google
//                          points to gemini-3.5-flash-lite instead.
//   gemini-3-flash         does not exist for generateContent.
//   gemini-omni-1.1-flash  400 "only supports Interactions API" — would need a
//                          different client entirely.
const DEFAULT_FALLBACK_MODELS = ["gemini-3.5-flash"];

function getConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY — set it in .env.local");
  }
  const primary = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
  const fbEnv = process.env.GEMINI_FALLBACK_MODELS?.trim();
  const fallbacks = fbEnv
    ? fbEnv.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_FALLBACK_MODELS;
  // Primary first, then fallbacks, de-duplicated (preserve order).
  const models = [...new Set([primary, ...fallbacks])];
  warnAboutAliases(models);
  return { apiKey, models };
}

// A `-latest` model id is a moving target: Google hot-swaps it to whatever the
// newest release is, so the model you are billed for — and its price — can
// change without any deploy on your side.
//
// This is not hypothetical for this project. The billing dashboard for
// August 2026 shows SEVEN distinct models charged to one key, including
// Gemini 3.6 Flash, 3.7 Flash and 3 Flash, none of which appear anywhere in
// this repo's config. They are what `gemini-flash-latest` (the primary from
// 2026-07-21 to 2026-08-25) and `gemini-flash-lite-latest` resolved to as
// Google rotated them. Pin explicit ids so a price change is a decision.
const warnedAliases = new Set<string>();
function warnAboutAliases(models: string[]) {
  for (const m of models) {
    if (!m.endsWith("-latest") || warnedAliases.has(m)) continue;
    warnedAliases.add(m);
    console.warn(
      `[gemini-config] "${m}" is a hot-swapping alias: Google decides which model (and price) you are billed for, and it can change without a deploy. Pin an explicit id, e.g. GEMINI_MODEL=gemini-3.1-flash-lite.`,
    );
  }
}

type UsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
};

type GeminiApiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: UsageMetadata;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function coerce(parsed: unknown): GeminiRaw {
  const o = (parsed ?? {}) as Record<string, unknown>;
  const conf = o.confidence;
  const confidence: AiConfidence =
    conf === "low" || conf === "high" ? conf : "medium";
  const rawItems = Array.isArray(o.items) ? o.items : [];
  const items: GeminiRawItem[] = rawItems.map((it) => {
    const r = (it ?? {}) as Record<string, unknown>;
    return {
      name: String(r.name ?? "").trim(),
      estimatedGrams: Math.max(0, num(r.estimatedGrams)),
      kcalPer100g: Math.max(0, num(r.kcalPer100g)),
      proteinPer100g: Math.max(0, num(r.proteinPer100g)),
      carbsPer100g: Math.max(0, num(r.carbsPer100g)),
      fatPer100g: Math.max(0, num(r.fatPer100g)),
    };
  });
  return {
    isFood: Boolean(o.isFood),
    title: String(o.title ?? "").trim() || "Obrok",
    confidence,
    items: items.filter((i) => i.name.length > 0),
    kcalMin: o.kcalMin == null ? null : Math.round(num(o.kcalMin)),
    kcalMax: o.kcalMax == null ? null : Math.round(num(o.kcalMax)),
  };
}

// Error thrown by a single-model attempt.
//
// `retryable` = worth trying the NEXT model in the chain. `billed` = this
// attempt very likely consumed (and was charged for) a generation.
//
// The two are deliberately linked: falling back after a BILLED failure buys a
// second full image request on top of one we already paid for, which is how a
// slow upstream used to double the bill on every single analysis. So a billed
// failure ends the chain and the user decides whether to retry, while an
// unbilled rejection (5xx / 404 / 400 / 429 / transport) still falls through
// for free.
class GeminiModelError extends Error {
  retryable: boolean;
  empty: boolean;
  billed: boolean;
  rateLimited: boolean;
  constructor(
    message: string,
    opts: {
      retryable: boolean;
      empty?: boolean;
      billed?: boolean;
      rateLimited?: boolean;
    },
  ) {
    super(message);
    this.name = "GeminiModelError";
    this.retryable = opts.retryable;
    this.empty = Boolean(opts.empty);
    this.billed = Boolean(opts.billed);
    this.rateLimited = Boolean(opts.rateLimited);
  }
}

/**
 * Thrown when the whole chain failed. `billed` is true when at least one
 * attempt very likely consumed paid generation capacity, which decides
 * whether the caller refunds the user's daily credit.
 */
export class GeminiChainError extends Error {
  billed: boolean;
  rateLimited: boolean;
  constructor(
    message: string,
    opts: { billed: boolean; rateLimited?: boolean },
  ) {
    super(message);
    this.name = "GeminiChainError";
    this.billed = opts.billed;
    this.rateLimited = Boolean(opts.rateLimited);
  }
}

const EMPTY_RAW: GeminiRaw = {
  isFood: false,
  title: "",
  confidence: "low",
  items: [],
  kcalMin: null,
  kcalMax: null,
};

type RequestBody = {
  systemInstruction: { parts: { text: string }[] };
  contents: { role: string; parts: Record<string, unknown>[] }[];
  generationConfig: Record<string, unknown>;
};

// ── Thinking / reasoning control ──────────────────────────────────────
//
// This is the most expensive single knob in the request: for gemini-3.5-flash
// the OUTPUT price ($9.00/1M) is documented as "including thinking tokens", so
// reasoning tokens bill at 6x the input rate. The task is constrained schema
// filling, which is where reasoning adds least.
//
// The parameter differs by model family, and getting it wrong is not free:
//   • gemini-2.5-*  → legacy `thinkingConfig.thinkingBudget` (0 disables).
//   • gemini-3.x    → `thinkingLevel` enum. The numeric budget is the LEGACY
//     parameter and Google's docs say to use the enum instead; sending BOTH is
//     a documented 400. Thinking cannot be fully disabled on 3.x — "minimal"
//     is the floor and still does not guarantee zero reasoning.
//   • *-lite        → rejects both outright (400 INVALID_ARGUMENT).
//
// `minimal` is valid for both gemini-3.5-flash and gemini-3.1-flash-lite, but
// it does NOT guarantee zero thinking tokens — Google documents it as "does not
// guarantee that thinking is off; the model may reason very minimally for
// complex tasks". So do not expect `thoughts: 0`; expect it to be SMALL, and
// judge it against the recorded average/median/max rather than against zero.
//
// ⚠️ VERIFY ON FIRST LIVE CALL. The previous implementation sent
// `thinkingBudget: 0` to gemini-3.5-flash, which is the wrong parameter for
// that family — it was either ignored (paying for default `medium` thinking at
// output rates) or rejected with a 400. If you see a 400 mentioning thinking,
// set GEMINI_THINKING_LEVEL="" to stop sending the field.
const THINKING_LEVEL = process.env.GEMINI_THINKING_LEVEL ?? "minimal";

function thinkingConfigFor(model: string): Record<string, unknown> {
  // Gemini 3.x — INCLUDING the -lite variants — uses the thinkingLevel enum.
  // The "-lite rejects thinking config" rule is a Gemini 2.5-era fact and must
  // NOT be applied to 3.x: gemini-3.5-flash-lite and gemini-3.1-flash-lite both
  // accept thinkingLevel. Excluding them left the Lite models reasoning at
  // their DEFAULT level while gemini-3.5-flash ran at "minimal" — which would
  // have made Lite look both slower and more expensive than it is, and quietly
  // invalidated any model comparison. Empty string opts out of the field.
  if (/gemini-3/.test(model)) {
    return THINKING_LEVEL ? { thinkingConfig: { thinkingLevel: THINKING_LEVEL } } : {};
  }
  // Gemini 1.x/2.x lite models reject every thinking parameter outright.
  if (model.includes("-lite")) return {};
  // Gemini 1.x/2.x: the legacy numeric budget, where 0 really is off.
  return { thinkingConfig: { thinkingBudget: 0 } };
}

// Adds the per-model generationConfig to a shared base body. Spreads rather
// than rebuilding so the base64 image is shared by reference, never copied.
function withThinkingConfig(base: RequestBody, model: string): RequestBody {
  const extra = {
    temperature: temperatureFor(model),
    ...thinkingConfigFor(model),
    ...mediaResolutionConfig(model),
  };
  return {
    ...base,
    generationConfig: { ...base.generationConfig, ...extra },
  };
}

function buildRequestBody(input: GeminiInput): RequestBody {
  const parts: Record<string, unknown>[] = [];
  const text = input.text?.trim();
  if (text) parts.push({ text });
  if (input.imageBase64) {
    parts.push({
      inlineData: {
        mimeType: input.mime || "image/jpeg",
        data: input.imageBase64,
      },
    });
  }
  if (parts.length === 0) {
    throw new Error("No input (image or text) provided");
  }
  // Nudge the model when only an image is present.
  if (!text) {
    parts.push({ text: "Analiziraj hranu na slici." });
  }
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      // Overridden per model family in withThinkingConfig.
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  };
}

type AttemptResult = { raw: GeminiRaw; usage?: UsageMetadata };

// One attempt against a single model. Throws GeminiModelError so the caller
// can decide whether to fall back.
async function callModel(
  model: string,
  apiKey: string,
  body: object,
  deadline: number,
): Promise<AttemptResult> {
  // Never let one hop eat the whole chain budget, and never start a hop we
  // have no time left to finish.
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new GeminiModelError(`${model}: chain deadline exceeded (timeout)`, {
      retryable: false,
    });
  }
  const timeoutMs = Math.min(REQUEST_TIMEOUT_MS, remaining);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const error = e as Error;
    const timedOut =
      error.name === "TimeoutError" || error.name === "AbortError";
    // A TIMEOUT means the generation is probably still running on Google's
    // side and will be billed. Re-sending the same image to another model
    // would pay for the same work twice, so a timeout ends the chain.
    // A transport failure (connection refused, DNS) never reached the model,
    // costs nothing, and stays retryable.
    throw new GeminiModelError(
      `${model}: ${timedOut ? `timeout after ${timeoutMs}ms` : `request failed: ${error.message}`}`,
      { retryable: !timedOut, billed: timedOut },
    );
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    // A rejected request generates no tokens, so falling through to the next
    // model is free. Only credential problems repeat identically on every
    // model and are worth stopping for.
    //
    // A 404 is model-SPECIFIC ("this id is no longer available"), so it must
    // fall through — treating it as fatal would have turned the dead
    // gemini-2.5-* primary into a hard outage instead of a fallback. 400 stays
    // retryable for the same reason: it can be a per-model param rejection.
    //
    // These are still OUR misconfiguration, not a Google outage; guard.ts
    // classifies them so the user isn't told "Gemini is down".
    // 429 = quota/rate limit. It is almost always a PROJECT-level limit rather
    // than a per-model one, so hopping to the next model just adds load during
    // the exact window Google is asking us to back off, and usually 429s again.
    // Nothing is billed either way, so this is about behaviour, not tokens:
    // stop the chain and return a clean "try again shortly" to the user.
    const rateLimited = res.status === 429;
    const fatal = res.status === 401 || res.status === 403;
    throw new GeminiModelError(`${model}: HTTP ${res.status}: ${detail}`, {
      retryable: !fatal && !rateLimited,
      rateLimited,
    });
  }

  const data = (await res.json().catch(() => null)) as GeminiApiResponse | null;
  const usage = data?.usageMetadata;
  const finishReason = data?.candidates?.[0]?.finishReason ?? "none";
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) {
    // The model ran and billed us either way, so do NOT buy the same answer
    // from another model.
    //
    // `empty` (→ surfaced to the user as the off-topic guard message) is only
    // correct for a safety block or a genuinely empty answer. A MAX_TOKENS
    // stop is OUR limit being too low, and telling the user "this assistant
    // only handles food" would be a lie that hides a config bug — so that case
    // stays a real error naming maxOutputTokens.
    const truncated = finishReason === "MAX_TOKENS";
    throw new GeminiModelError(
      truncated
        ? `${model}: response hit maxOutputTokens (${MAX_OUTPUT_TOKENS}) — raise GEMINI_MAX_OUTPUT_TOKENS`
        : `${model}: empty candidate (finishReason=${finishReason})`,
      { retryable: false, empty: !truncated, billed: true },
    );
  }

  try {
    return { raw: coerce(JSON.parse(raw)), usage };
  } catch {
    // Malformed output despite responseSchema — vanishingly rare, and the
    // tokens are already paid for. Another model would be a second full
    // charge on a low-probability improvement, so stop and let the user
    // decide; guard.ts still reports this as an upstream problem.
    throw new GeminiModelError(`${model}: non-JSON output`, {
      retryable: false,
      billed: true,
    });
  }
}

// Calls Gemini with automatic fallback across the configured model chain and
// returns the validated result plus the model that produced it. Throws only
// when every model fails with a real error (auth, or all retryables exhausted).
export async function analyzeWithGemini(
  input: GeminiInput,
  meta: {
    feature: string;
    requestId?: string;
    // Overrides the configured chain. Only used by the dev-only model
    // comparison script, which needs to pin one model per run.
    models?: string[];
  } = { feature: "ai-meal-analyze" },
): Promise<{
  raw: GeminiRaw;
  model: string;
  requestId: string;
  usage?: { promptTokens: number; outputTokens: number; thoughtTokens: number };
}> {
  const cfg = getConfig();
  const apiKey = cfg.apiKey;
  const models = meta.models?.length ? meta.models : cfg.models;
  const base = buildRequestBody(input);
  const deadline = Date.now() + CHAIN_DEADLINE_MS;
  const requestId = meta.requestId ?? randomUUID().slice(0, 8);

  let lastError: GeminiModelError | null = null;
  const failures: string[] = [];
  let sawEmpty = false;
  let anyBilled = false;
  let rateLimited = false;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const startedAt = Date.now();
    try {
      const { raw, usage } = await callModel(
        model,
        apiKey,
        withThinkingConfig(base, model),
        deadline,
      );
      recordGeminiUsage({
        requestId,
        feature: meta.feature,
        model,
        attempt: i + 1,
        outcome: "ok",
        promptTokens: usage?.promptTokenCount ?? null,
        outputTokens: usage?.candidatesTokenCount ?? null,
        thoughtTokens: usage?.thoughtsTokenCount ?? null,
        totalTokens: usage?.totalTokenCount ?? null,
        billedWithoutResult: false,
        durationMs: Date.now() - startedAt,
      });
      return {
        raw,
        model,
        requestId,
        usage: {
          promptTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
          thoughtTokens: usage?.thoughtsTokenCount ?? 0,
        },
      };
    } catch (e) {
      const err =
        e instanceof GeminiModelError
          ? e
          : new GeminiModelError((e as Error).message, { retryable: false });
      lastError = err;
      failures.push(err.message);
      if (err.empty) sawEmpty = true;
      if (err.billed) anyBilled = true;
      if (err.rateLimited) rateLimited = true;
      recordGeminiUsage({
        requestId,
        feature: meta.feature,
        model,
        attempt: i + 1,
        outcome: "error",
        promptTokens: null,
        outputTokens: null,
        thoughtTokens: null,
        totalTokens: null,
        billedWithoutResult: err.billed,
        durationMs: Date.now() - startedAt,
        error: err.message,
      });
      // Non-retryable → stop. This covers both "no point trying others"
      // (auth) and "we already paid for this one" (timeout / empty /
      // malformed): see the GeminiModelError doc comment.
      if (!err.retryable) break;
      // Otherwise fall through to the next model.
    }
  }

  // If any attempt came back with no candidate, treat it as a legitimate
  // non-food/safety result (off-topic path) instead of an error, so guarded
  // content doesn't surface as a crash.
  if (sawEmpty) {
    return { raw: EMPTY_RAW, model: models[0], requestId };
  }
  // Report EVERY model's failure, not just the last one. Classification looks
  // at this text: with only the last error, an outage on the primary (503)
  // was hidden behind a later model answering 404 and got blamed on us.
  //
  // `billed` tells the route whether Google actually charged us. A 503/404/
  // transport rejection generated nothing and the user's daily credit is
  // refunded; a timeout or a malformed generation DID cost money, so the
  // credit stands. Without this the daily cap bounded successes rather than
  // spend, and a degraded upstream could be retried without limit.
  const aggregate = new GeminiChainError(
    failures.length > 0
      ? `All Gemini models failed: ${failures.join("; ")}`
      : (lastError?.message ?? "All Gemini models failed"),
    { billed: anyBilled, rateLimited },
  );
  throw aggregate;
}
