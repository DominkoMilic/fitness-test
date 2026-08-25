import "server-only";
import { normalizeForSearch } from "@/lib/utils/normalize";
import { contentStems } from "./foodText";
import { getFoodsIndex } from "./foodsIndex";
import type { FoodMatchRow, FoodsIndex, IndexedFood } from "./foodsIndex";
import type { AiAnalysisItem, AiAnalysisResult, DailyTotals } from "@/types/app";
import type { GeminiRaw, GeminiRawItem } from "./gemini";

// Consistency rule: whenever a recognized item's name matches a row in our
// `foods` table, we DISCARD the model's nutrition and recompute from the DB.
// Only truly unknown items keep the model's estimate. This keeps AI logging
// aligned with the rest of the app, which always computes from `foods`.

const round1 = (n: number) => Math.round(n * 10) / 10;

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

// Sørensen–Dice similarity over content stems: 2·|A∩B| / (|A|+|B|).
// Symmetric, so it punishes BOTH missing query words and extra candidate
// words — "umak od rajčice" vs "Kikkoman umak od sezama" scores 0.4 and is
// rejected, instead of winning on the shared word "umak".
function similarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bSet = new Set(b);
  let inter = 0;
  for (const t of a) if (bSet.has(t)) inter++;
  return (2 * inter) / (a.length + b.length);
}

// Acceptance thresholds. Dice alone is not enough: "umak od rajčice" vs
// "rajčica" scores 0.67 (only one word each side), yet raw tomato is NOT
// tomato sauce — the dropped word "umak" changes the dish. So a row is
// accepted only when either
//   (a) the candidate explains virtually the whole query AND isn't mostly
//       unrelated extra words ("rajčica" ↔ "Rajčica"), or
//   (b) the two names overlap very strongly overall, which tolerates a
//       missing detail word ("kuhana tjestenina (špageti)" ↔ "Tjestenina
//       kuhana").
const MIN_QUERY_COVERAGE = 0.8; // share of query words found in candidate
const MIN_CANDIDATE_COVERAGE = 0.5; // share of candidate words found in query
const STRONG_SIMILARITY = 0.75; // Dice good enough on its own

function accepts(query: string[], cand: string[]): number {
  if (query.length === 0 || cand.length === 0) return 0;
  const candSet = new Set(cand);
  let inter = 0;
  for (const t of query) if (candSet.has(t)) inter++;
  if (inter === 0) return 0;

  const queryCoverage = inter / query.length;
  const candCoverage = inter / cand.length;
  const dice = similarity(query, cand);

  const ok =
    (queryCoverage >= MIN_QUERY_COVERAGE &&
      candCoverage >= MIN_CANDIDATE_COVERAGE) ||
    dice >= STRONG_SIMILARITY;

  return ok ? dice : 0;
}

// Pick the best DB row for a query among candidates, requiring a genuine
// match. Ties broken by the shorter (more specific) name.
function bestMatch(
  queryStems: string[],
  candidates: IndexedFood[],
): FoodMatchRow | null {
  let best: FoodMatchRow | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = accepts(queryStems, c.stems);
    if (score <= 0) continue;
    if (
      score > bestScore ||
      (score === bestScore &&
        best &&
        c.row.normalized_name.length < best.normalized_name.length)
    ) {
      best = c.row;
      bestScore = score;
    }
  }
  return best;
}

function matchOne(raw: GeminiRawItem, index: FoodsIndex): AiAnalysisItem {
  const grams = Math.max(0, round1(raw.estimatedGrams));
  const norm = normalizeForSearch(raw.name);

  let match: FoodMatchRow | null = null;

  if (norm) {
    // 1) exact normalized-name match
    match = index.byNormalized.get(norm) ?? null;

    // 2) fuzzy. Candidates used to be gathered with one `ilike('%stem%')` per
    //    stem, capped at 25 rows each; now every row is scored, so a good
    //    match can no longer fall outside the cap. The query stem set and the
    //    length gate are unchanged, so scoring behaves as before.
    if (!match) {
      const stems = contentStems(norm).slice(0, 3);
      const searchable = stems.filter((s) => s.length >= 3);
      if (searchable.length > 0) {
        match = bestMatch(stems, index.entries);
      }
    }
  }

  if (match) {
    const per100 = {
      kcal: Number(match.kcal_per_100g) || 0,
      p: Number(match.protein) || 0,
      u: Number(match.carbs) || 0,
      m: Number(match.fat) || 0,
    };
    return {
      name: raw.name,
      grams,
      ...scaleFromPer100g(grams, per100),
      source: "db",
      matchedFoodId: match.id,
      matchedFoodName: match.name,
      per100,
    };
  }

  // No DB match → keep the model's own per-100g estimate.
  const per100 = {
    kcal: round1(raw.kcalPer100g),
    p: round1(raw.proteinPer100g),
    u: round1(raw.carbsPer100g),
    m: round1(raw.fatPer100g),
  };
  return {
    name: raw.name,
    grams,
    ...scaleFromPer100g(grams, per100),
    source: "ai",
    matchedFoodId: null,
    matchedFoodName: null,
    per100,
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
  const index = await getFoodsIndex();
  const items = raw.items.map((item) => matchOne(item, index));
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
