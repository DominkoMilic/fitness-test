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
  name: string;
  normalized_name: string;
  kcal_per_100g: number;
  protein: number;
  carbs: number;
  fat: number;
};

const FOOD_COLUMNS =
  "id, name, normalized_name, kcal_per_100g, protein, carbs, fat";

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

// Croatian//English filler words. They carry no identity ("umak OD rajčice"
// vs "umak OD sezama") and must never contribute to a match score.
const STOPWORDS = new Set([
  "od", "sa", "s", "u", "i", "za", "bez", "na", "iz", "po", "te", "ili",
  "with", "and", "the", "of",
]);

// Very light Croatian stemmer: strips a case ending so declined forms unify
// ("rajčice"/"rajčica" → "rajcic", "tjesteninom" → "tjestenin"). Deliberately
// conservative — aggressive suffix stripping merges unrelated words.
function stem(token: string): string {
  let s = token;
  if (s.length > 4 && /(om|em|im)$/.test(s)) s = s.slice(0, -2);
  if (s.length > 3 && /[aeiou]$/.test(s)) s = s.slice(0, -1);
  return s;
}

// Identity-bearing, stemmed tokens of a normalized name. Punctuation is
// stripped here (normalizeForSearch keeps it, and it's mirrored in the DB, so
// we must not change that shared function).
function contentStems(normalized: string): string[] {
  const cleaned = normalized.replace(/[^\p{L}\p{N}\s]+/gu, " ");
  const out: string[] = [];
  for (const t of tokenize(cleaned)) {
    if (t.length < 2 || STOPWORDS.has(t)) continue;
    const s = stem(t);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
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
  candidates: FoodMatchRow[],
): FoodMatchRow | null {
  let best: FoodMatchRow | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = accepts(queryStems, contentStems(c.normalized_name));
    if (score <= 0) continue;
    if (
      score > bestScore ||
      (score === bestScore &&
        best &&
        c.normalized_name.length < best.normalized_name.length)
    ) {
      best = c;
      bestScore = score;
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
      .select(FOOD_COLUMNS)
      .eq("status", "imported")
      .eq("normalized_name", norm)
      .limit(1);
    match = (exact?.[0] as FoodMatchRow | undefined) ?? null;

    // 2) fuzzy: gather candidates for EVERY identity-bearing word, not just
    //    the first one. Searching only the first token meant "umak od
    //    rajčice" only ever looked at `%umak%` products and never saw the
    //    tomato ones. Results are pooled, then scored; a candidate is used
    //    only if it clears MIN_SIMILARITY.
    if (!match) {
      const stems = contentStems(norm).slice(0, 3);
      const searchable = stems.filter((s) => s.length >= 3);
      if (searchable.length > 0) {
        const results = await Promise.all(
          searchable.map((s) =>
            supa
              .from("foods")
              .select(FOOD_COLUMNS)
              .eq("status", "imported")
              .ilike("normalized_name", `%${s}%`)
              .limit(25),
          ),
        );
        const pool = new Map<number, FoodMatchRow>();
        for (const r of results) {
          for (const row of (r.data as FoodMatchRow[] | null) ?? []) {
            pool.set(row.id, row);
          }
        }
        match = bestMatch(stems, Array.from(pool.values()));
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
