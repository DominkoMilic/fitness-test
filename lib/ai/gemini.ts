import "server-only";
import type { AiConfidence } from "@/types/app";

// Server-only Gemini Vision client. Raw fetch against the REST API — no SDK,
// matching the app's style (see lib/api/openFoodFacts.ts). The API key stays
// server-side; this module must never be imported from a client component.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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
  notes?: string;
};

export type GeminiInput = {
  // base64 (no data: prefix) + mime, when a photo is provided.
  imageBase64?: string;
  mime?: string;
  // Free text: food name + details, when there's no photo (or in addition).
  text?: string;
};

const SYSTEM_PROMPT = `Ti si asistent koji ISKLJUČIVO procjenjuje nutritivne vrijednosti hrane iz slike i/ili kratkog opisa.

Pravila:
- Ako ulaz NIJE hrana ili je nevezano pitanje (npr. opće znanje, kod, savjeti), postavi "isFood": false i vrati praznu listu "items". NE odgovaraj na nevezana pitanja.
- Ako je hrana: procijeni jelo/namirnice, gramaturu svake stavke i PRIBLIŽNE nutritivne vrijednosti na 100 g (kcal, proteini, ugljikohidrati, masti).
- Za složena jela (npr. "bolonjez u restoranu") daj jednu ili više glavnih stavki i realan raspon ukupnih kalorija u "kcalMin"/"kcalMax".
- Koristi hrvatske nazive namirnica.
- Vrijednosti su procjena, ne izmišljaj lažnu preciznost. Postavi "confidence" na "low" kad je slika nejasna ili opis nedovoljan.
- Odgovori ISKLJUČIVO validnim JSON-om prema zadanoj shemi.`;

// Gemini responseSchema (OpenAPI subset) — forces structured JSON output.
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
    notes: { type: "STRING", nullable: true },
  },
  required: ["isFood", "title", "confidence", "items"],
} as const;

// Ordered fallback chain used when GEMINI_FALLBACK_MODELS is not set. If the
// primary model is overloaded / unavailable / returns unusable data, we retry
// the next one. "-latest" aliases first (resilient to pinned-model deprecations),
// then concrete lighter models as cheaper/available backups.
const DEFAULT_FALLBACK_MODELS = [
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
];

function getConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY — set it in .env.local");
  }
  const primary = process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";
  const fbEnv = process.env.GEMINI_FALLBACK_MODELS?.trim();
  const fallbacks = fbEnv
    ? fbEnv.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_FALLBACK_MODELS;
  // Primary first, then fallbacks, de-duplicated (preserve order).
  const models = [...new Set([primary, ...fallbacks])];
  return { apiKey, models };
}

type GeminiApiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
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
    notes: o.notes == null ? undefined : String(o.notes),
  };
}

// Error thrown by a single-model attempt. `retryable` = worth trying the next
// model in the chain (overload, 5xx, 404, transport, bad output). `empty` =
// the model returned no candidate (safety block / empty) rather than an error.
class GeminiModelError extends Error {
  retryable: boolean;
  empty: boolean;
  constructor(message: string, opts: { retryable: boolean; empty?: boolean }) {
    super(message);
    this.name = "GeminiModelError";
    this.retryable = opts.retryable;
    this.empty = Boolean(opts.empty);
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

function buildRequestBody(input: GeminiInput) {
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
    parts.push({
      text: "Analiziraj hranu na slici i procijeni nutritivne vrijednosti.",
    });
  }
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };
}

// One attempt against a single model. Throws GeminiModelError so the caller
// can decide whether to fall back.
async function callModel(
  model: string,
  apiKey: string,
  body: object,
): Promise<GeminiRaw> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // Transport failure — try the next model.
    throw new GeminiModelError(`${model}: request failed: ${(e as Error).message}`, {
      retryable: true,
    });
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    // Auth/permission problems repeat on every model → don't waste calls.
    const fatal = res.status === 401 || res.status === 403;
    throw new GeminiModelError(`${model}: HTTP ${res.status}: ${detail}`, {
      retryable: !fatal,
    });
  }

  const data = (await res.json().catch(() => null)) as GeminiApiResponse | null;
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) {
    // No candidate — could be a safety block or a transient hiccup. Mark it
    // retryable+empty: try the next model, but if ALL come back empty we treat
    // it as a genuine non-food/off-topic result rather than a hard error.
    throw new GeminiModelError(`${model}: empty candidate`, {
      retryable: true,
      empty: true,
    });
  }

  try {
    return coerce(JSON.parse(raw));
  } catch {
    // Malformed output — another model may do better.
    throw new GeminiModelError(`${model}: non-JSON output`, { retryable: true });
  }
}

// Calls Gemini with automatic fallback across the configured model chain and
// returns the validated result plus the model that produced it. Throws only
// when every model fails with a real error (auth, or all retryables exhausted).
export async function analyzeWithGemini(
  input: GeminiInput,
): Promise<{ raw: GeminiRaw; model: string }> {
  const { apiKey, models } = getConfig();
  const body = buildRequestBody(input);

  let lastError: GeminiModelError | null = null;
  let sawEmpty = false;

  for (const model of models) {
    try {
      const raw = await callModel(model, apiKey, body);
      return { raw, model };
    } catch (e) {
      const err =
        e instanceof GeminiModelError
          ? e
          : new GeminiModelError((e as Error).message, { retryable: false });
      lastError = err;
      if (err.empty) sawEmpty = true;
      // Non-retryable (e.g. auth) → stop immediately, no point trying others.
      if (!err.retryable) throw err;
      // Otherwise fall through to the next model.
    }
  }

  // Every model was tried. If the only failures were "empty candidate", treat
  // it as a legitimate non-food/safety result (off-topic path) instead of an
  // error, so guarded content doesn't surface as a crash.
  if (sawEmpty) {
    return { raw: EMPTY_RAW, model: models[models.length - 1] };
  }
  throw lastError ?? new Error("All Gemini models failed");
}
