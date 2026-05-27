import { supabase } from "@/lib/supabase/client";
import { DEFAULT_FOODS } from "@/lib/constants/defaultFoods";
import { normalizeForSearch } from "@/lib/utils/normalize";
import { normalizeBarcode } from "@/lib/barcode/normalize";
import type { FoodEntry } from "@/types/app";
import type { FoodRow } from "@/types/database";

// Bumped on schema change (added normalizedName) so stale caches are
// discarded rather than reused without the searchable field.
const CACHE_KEY = "kf_foods_cache_v2";
const CACHE_TS_KEY = "kf_foods_cache_v2_ts";
const LEGACY_CACHE_KEYS = ["kf_foods_cache", "kf_foods_cache_ts"];
const TTL = 2 * 60 * 60 * 1000; // 2h
export const FOODS_CHANGED_EVENT = "kf-foods-changed";

function rowToEntry(row: FoodRow): FoodEntry {
  const e: FoodEntry = {
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name || normalizeForSearch(row.name),
    kcal: Number(row.kcal_per_100g) || 0,
    p: Number(row.protein) || 0,
    u: Number(row.carbs) || 0,
    m: Number(row.fat) || 0,
  };
  if (row.barcode) e.barcode = row.barcode;
  if (row.piece_weight_g && row.piece_name) {
    e.piece_g = Number(row.piece_weight_g);
    e.piece_label = row.piece_name;
  }
  if (row.has_cup) e.has_cup = true;
  if (row.has_spoons) e.has_spoons = true;
  return e;
}

function readCache(): { entries: FoodEntry[]; fresh: boolean } | null {
  if (typeof window === "undefined") return null;
  try {
    LEGACY_CACHE_KEYS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(CACHE_KEY);
    const ts = parseInt(localStorage.getItem(CACHE_TS_KEY) || "0");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FoodEntry[];
    if (!Array.isArray(parsed) || !parsed.length) return null;
    return { entries: parsed, fresh: Date.now() - ts < TTL };
  } catch {
    return null;
  }
}

function writeCache(entries: FoodEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  } catch {}
}

export function clearFoodsCache() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_TS_KEY);
  window.dispatchEvent(new Event(FOODS_CHANGED_EVENT));
}

// 2h-cached read of imported foods. Falls back to DEFAULT_FOODS only when
// neither cache nor DB returns rows (cold start / first run).
//
// PAGINATED — Supabase caps single-request reads at 1000 rows. Without
// pagination, foods past row 1000 were invisible to the client.
const FOODS_PAGE = 1000;

export async function loadFoods(): Promise<FoodEntry[]> {
  const cache = readCache();
  if (cache?.fresh) return cache.entries;

  const all: FoodEntry[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("foods")
      .select("*")
      .eq("status", "imported")
      .order("id", { ascending: true })
      .range(from, from + FOODS_PAGE - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    for (const row of data) all.push(rowToEntry(row));
    if (data.length < FOODS_PAGE) break;
    from += FOODS_PAGE;
  }

  if (!all.length) return cache?.entries ?? DEFAULT_FOODS;
  writeCache(all);
  return all;
}

// Lookup a single food by scanned barcode. Cache-first (instant if cached
// foods are already loaded), then Supabase by exact match on the normalized
// barcode. Returns null when nothing matches.
export async function findFoodByBarcode(
  rawCode: string,
): Promise<FoodEntry | null> {
  const code = normalizeBarcode(rawCode);
  if (!code) return null;

  // 1) In-memory cache check — avoids round-trip when useFoods already
  //    populated localStorage. Stale cache is acceptable here: a barcode
  //    moving foods is extremely rare; worst case we fall through to DB.
  const cache = readCache();
  if (cache) {
    const hit = cache.entries.find((f) => f.barcode === code);
    if (hit) return hit;
  }

  // 2) DB lookup. Single-row, indexed (ux_foods_barcode).
  const { data, error } = await supabase
    .from("foods")
    .select("*")
    .eq("barcode", code)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return rowToEntry(data);
}
