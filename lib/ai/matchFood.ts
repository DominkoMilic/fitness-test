import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeForSearch, tokenize } from "@/lib/utils/normalize";
import type { AiAnalysisItem, AiAnalysisResult, DailyTotals } from "@/types/app";
import type { GeminiRaw, GeminiRawItem } from "./gemini";

// Consistency rule: whenever a recognized item's name matches a row in our
// `foods` table, we DISCARD the model's nutrition and recompute from the DB.
// Only truly unknown items keep the model's estimate. This keeps AI logging
// aligned with the rest of the app, which always computes from `foods`.

const round1 = (n: number) => Math.round(n * 10) / 10;

type FoodMatchRow = {
  id: number;
  normalized_name: string;
  kcal_per_100g: number;
  protein: number;
  carbs: number;
  fat: number;
};

function scaleFromPer100g(
  grams: number,
  per100: { kcal: number; p: number; u: number; m: number },
) {
  const r = grams / 100;
  return {
    kcal: round1(per100.kcal * r),
    p: round1(per100.p * r),
    u: round1(per100.u * r),
    m: round1(per100.m * r),
  };
}

// Pick the best DB row for a normalized query among `ilike` candidates:
// most shared tokens wins, ties broken by shorter name (more specific).
function bestByTokenOverlap(
  normQuery: string,
  candidates: FoodMatchRow[],
): FoodMatchRow | null {
  const qTokens = new Set(tokenize(normQuery));
  if (qTokens.size === 0) return null;
  let best: FoodMatchRow | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const cTokens = tokenize(c.normalized_name);
    const overlap = cTokens.filter((t) => qTokens.has(t)).length;
    if (overlap === 0) continue;
    if (
      overlap > bestScore ||
      (overlap === bestScore &&
        best &&
        c.normalized_name.length < best.normalized_name.length)
    ) {
      best = c;
      bestScore = overlap;
    }
  }
  return best;
}

async function matchOne(
  raw: GeminiRawItem,
): Promise<AiAnalysisItem> {
  const supa = getSupabaseAdmin();
  const grams = Math.max(0, round1(raw.estimatedGrams));
  const norm = normalizeForSearch(raw.name);

  let match: FoodMatchRow | null = null;

  if (norm) {
    // 1) exact normalized-name match (fast, indexed)
    const { data: exact } = await supa
      .from("foods")
      .select("id, normalized_name, kcal_per_100g, protein, carbs, fat")
      .eq("status", "imported")
      .eq("normalized_name", norm)
      .limit(1);
    match = (exact?.[0] as FoodMatchRow | undefined) ?? null;

    // 2) fallback: fuzzy contains on the first token, pick best overlap
    if (!match) {
      const firstToken = tokenize(norm)[0];
      if (firstToken && firstToken.length >= 3) {
        const { data: fuzzy } = await supa
          .from("foods")
          .select("id, normalized_name, kcal_per_100g, protein, carbs, fat")
          .eq("status", "imported")
          .ilike("normalized_name", `%${firstToken}%`)
          .limit(20);
        match = bestByTokenOverlap(norm, (fuzzy as FoodMatchRow[]) ?? []);
      }
    }
  }

  if (match) {
    const scaled = scaleFromPer100g(grams, {
      kcal: Number(match.kcal_per_100g) || 0,
      p: Number(match.protein) || 0,
      u: Number(match.carbs) || 0,
      m: Number(match.fat) || 0,
    });
    return {
      name: raw.name,
      grams,
      ...scaled,
      source: "db",
      matchedFoodId: match.id,
    };
  }

  // No DB match → keep the model's own per-100g estimate.
  const scaled = scaleFromPer100g(grams, {
    kcal: raw.kcalPer100g,
    p: raw.proteinPer100g,
    u: raw.carbsPer100g,
    m: raw.fatPer100g,
  });
  return {
    name: raw.name,
    grams,
    ...scaled,
    source: "ai",
    matchedFoodId: null,
  };
}

function sumItems(items: AiAnalysisItem[]): DailyTotals {
  return items.reduce<DailyTotals>(
    (acc, i) => ({
      kcal: round1(acc.kcal + i.kcal),
      p: round1(acc.p + i.p),
      u: round1(acc.u + i.u),
      m: round1(acc.m + i.m),
    }),
    { kcal: 0, p: 0, u: 0, m: 0 },
  );
}

// Turns a raw Gemini result into the final analysis: each item matched
// against `foods` (DB nutrition wins), totals summed from the resolved items.
export async function buildAnalysisFromRaw(
  raw: GeminiRaw,
): Promise<AiAnalysisResult> {
  const items = await Promise.all(raw.items.map(matchOne));
  const totals = sumItems(items);
  return {
    title: raw.title,
    confidence: raw.confidence,
    items,
    totals,
    kcalMin: raw.kcalMin,
    kcalMax: raw.kcalMax,
    notes: raw.notes,
  };
}
