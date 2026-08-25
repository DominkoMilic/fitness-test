import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { contentStems } from "./foodText";

// In-memory index of the `foods` table, built once and reused across requests.
//
// Why: matching used to run, per recognized item, one exact `eq` plus up to 3
// `ilike('%stem%')` queries — unindexed leading-wildcard scans, 2 round trips
// deep, all AFTER the model had already answered. The table is small (~2.7k
// rows), so holding it in memory removes every DB round trip from the match
// step and deletes the wildcard scans entirely.
//
// Staleness: admin sheet-sync writes `foods`, so it calls invalidateFoodsIndex()
// on completion. The TTL is the backstop for any other write path, and bounds
// how long a serverless instance can serve stale rows.

export type FoodMatchRow = {
  id: number;
  name: string;
  normalized_name: string;
  kcal_per_100g: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const FOOD_COLUMNS =
  "id, name, normalized_name, kcal_per_100g, protein, carbs, fat";

// Stems are precomputed at load time: previously every candidate row was
// re-stemmed on every request.
export type IndexedFood = { row: FoodMatchRow; stems: string[] };

export type FoodsIndex = {
  byNormalized: Map<string, FoodMatchRow>;
  entries: IndexedFood[];
};

const TTL_MS = 5 * 60 * 1000;
// Supabase caps single-request reads at 1000 rows (see lib/api/foods.ts).
const PAGE = 1000;

let cache: { index: FoodsIndex; expires: number } | null = null;
// Concurrent requests on a cold instance must share one load, not race N.
let inFlight: Promise<FoodsIndex> | null = null;

export function invalidateFoodsIndex() {
  cache = null;
  inFlight = null;
}

async function load(): Promise<FoodsIndex> {
  const supa = getSupabaseAdmin();
  const rows: FoodMatchRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supa
      .from("foods")
      .select(FOOD_COLUMNS)
      .eq("status", "imported")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`foods index load failed: ${error.message}`);
    const batch = (data ?? []) as FoodMatchRow[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }

  const byNormalized = new Map<string, FoodMatchRow>();
  const entries: IndexedFood[] = [];
  for (const row of rows) {
    const norm = row.normalized_name ?? "";
    // First row wins, matching the previous `.limit(1)` exact lookup.
    if (norm && !byNormalized.has(norm)) byNormalized.set(norm, row);
    entries.push({ row, stems: contentStems(norm) });
  }
  return { byNormalized, entries };
}

export async function getFoodsIndex(): Promise<FoodsIndex> {
  if (cache && cache.expires > Date.now()) return cache.index;
  if (inFlight) return inFlight;

  inFlight = load()
    .then((index) => {
      cache = { index, expires: Date.now() + TTL_MS };
      return index;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
