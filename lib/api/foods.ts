import { supabase } from "@/lib/supabase/client";
import { DEFAULT_FOODS } from "@/lib/constants/defaultFoods";
import type { FoodEntry } from "@/types/app";
import type { FoodInsert, FoodRow } from "@/types/database";

const CACHE_KEY = "kf_foods_cache";
const CACHE_TS_KEY = "kf_foods_cache_ts";
const TTL = 2 * 60 * 60 * 1000; // 2h

function rowToEntry(row: FoodRow): FoodEntry {
  const e: FoodEntry = {
    id: row.id,
    name: row.name,
    kcal: Number(row.kcal_per_100g) || 0,
    p: Number(row.protein) || 0,
    u: Number(row.carbs) || 0,
    m: Number(row.fat) || 0,
  };
  if (row.piece_weight_g && row.piece_name) {
    e.piece_g = Number(row.piece_weight_g);
    e.piece_label = row.piece_name;
  }
  return e;
}

function readCache(): { entries: FoodEntry[]; fresh: boolean } | null {
  if (typeof window === "undefined") return null;
  try {
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
}

// Returns { entries, fromCache } and triggers async refresh if cache is stale.
export async function loadFoods(): Promise<FoodEntry[]> {
  const cache = readCache();
  if (cache?.fresh) return cache.entries;

  const { data } = await supabase.from("foods").select("*").eq("status", "imported");
  if (!data || !data.length) return cache?.entries ?? DEFAULT_FOODS;
  const entries = data.map(rowToEntry);
  writeCache(entries);
  return entries;
}

export async function listImportedFoodNames(): Promise<Set<string>> {
  const { data } = await supabase.from("foods").select("name");
  const set = new Set<string>();
  (data ?? []).forEach((r) => set.add((r.name || "").trim().toLowerCase()));
  return set;
}

export async function insertFoods(foods: FoodInsert[]) {
  const results = await Promise.all(
    foods.map((f) => supabase.from("foods").insert(f).then((r) => !r.error)),
  );
  return { ok: results.filter(Boolean).length, fail: results.filter((r) => !r).length };
}
