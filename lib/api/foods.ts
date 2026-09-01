import { supabase } from "@/lib/supabase/client";
import { DEFAULT_FOODS } from "@/lib/constants/defaultFoods";
import { normalizeForSearch } from "@/lib/utils/normalize";
import { normalizeBarcode } from "@/lib/barcode/normalize";
import type { FoodEntry } from "@/types/app";
import type { FoodRow } from "@/types/database";

// Bumped on schema change (added normalizedName) so stale caches are
// discarded rather than reused without the searchable field.
const CACHE_KEY = "kf_foods_cache_v2";
// Version stamp the cached list was built from — see fetchFoodsStamp.
const STAMP_KEY = "kf_foods_cache_v2_stamp";
// When we last asked the server for a stamp, to bound probe frequency.
const PROBE_TS_KEY = "kf_foods_cache_v2_probe";
// Keys from earlier cache designs, including the pre-stamp `_ts` freshness
// timestamp. Removed on every read so old installs don't carry them forever.
const LEGACY_CACHE_KEYS = [
  "kf_foods_cache",
  "kf_foods_cache_ts",
  "kf_foods_cache_v2_ts",
];

// Every localStorage key this module owns. Exported so the settings screen's
// hard-refresh clears the whole set instead of a hand-listed subset that
// drifts as keys are added — a "cleared" cache that kept its stamp would be
// judged up to date against a list that no longer exists.
export const FOODS_CACHE_KEYS = [
  CACHE_KEY,
  STAMP_KEY,
  PROBE_TS_KEY,
  ...LEGACY_CACHE_KEYS,
];

export const FOODS_CHANGED_EVENT = "kf-foods-changed";

// Minimum gap between stamp probes. The probe is ~100 bytes, so this is not
// about bandwidth — it's that useFoods mounts on several screens and we don't
// want a request per route change.
const PROBE_INTERVAL_MS = 60 * 1000;

// Supabase PostgREST caps single-request reads at 1000 rows.
const FOODS_PAGE = 1000;

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

type CachedFoods = { entries: FoodEntry[]; stamp: string | null };

function readCache(): CachedFoods | null {
  if (typeof window === "undefined") return null;
  try {
    LEGACY_CACHE_KEYS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FoodEntry[];
    if (!Array.isArray(parsed) || !parsed.length) return null;
    return { entries: parsed, stamp: localStorage.getItem(STAMP_KEY) };
  } catch {
    return null;
  }
}

function writeCache(entries: FoodEntry[], stamp: string | null) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
    // A list stored without a stamp must re-fetch rather than be trusted, so
    // drop any previous stamp instead of leaving it to describe stale rows.
    if (stamp) localStorage.setItem(STAMP_KEY, stamp);
    else localStorage.removeItem(STAMP_KEY);
  } catch {}
}

export function clearFoodsCache() {
  if (typeof window === "undefined") return;
  FOODS_CACHE_KEYS.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  });
  window.dispatchEvent(new Event(FOODS_CHANGED_EVENT));
}

function lastProbeAt(): number {
  try {
    return Number(localStorage.getItem(PROBE_TS_KEY)) || 0;
  } catch {
    return 0;
  }
}

function markProbed() {
  try {
    localStorage.setItem(PROBE_TS_KEY, String(Date.now()));
  } catch {}
}

/**
 * Cheap "has the food table changed?" probe: newest updated_at plus the exact
 * row count, in ONE request of roughly 100 bytes — the count rides back in the
 * Content-Range header rather than the body.
 *
 * Both halves are load-bearing:
 *   • max(updated_at) catches inserts AND edits — but only because
 *     2026-09-01_foods-updated-at.sql bumps updated_at on UPDATE. Without that
 *     trigger this sees inserts only and edits go unnoticed.
 *   • the row count catches deletes, which move no timestamp at all.
 * A sync that deletes one row and inserts another leaves the count equal, but
 * the insert moves the timestamp, so the pair still changes.
 *
 * Filtered to status='imported' so it describes exactly the set loadFoods()
 * fetches — a stamp taken over a different row set would not mean anything.
 */
async function fetchFoodsStamp(): Promise<string | null> {
  const { data, count, error } = await supabase
    .from("foods")
    .select("updated_at", { count: "exact" })
    .eq("status", "imported")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error || count == null) return null;
  return `${data?.[0]?.updated_at ?? ""}|${count}`;
}

// PAGINATED — Supabase caps single-request reads at 1000 rows. Without
// pagination, foods past row 1000 were invisible to the client.
async function fetchAllFoods(): Promise<FoodEntry[]> {
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
  return all;
}

let revalidating: Promise<void> | null = null;

async function runRevalidate(cachedStamp: string | null): Promise<void> {
  const stamp = await fetchFoodsStamp();
  markProbed();
  // Probe failed (offline, transient error). Keep serving what we have and
  // try again on the next call — never drop a usable cache over a failed check.
  if (!stamp) return;
  // Unchanged. This is the overwhelmingly common path, and it cost ~100 bytes.
  if (cachedStamp && stamp === cachedStamp) return;

  const entries = await fetchAllFoods();
  if (!entries.length) return;
  writeCache(entries, stamp);
  window.dispatchEvent(new Event(FOODS_CHANGED_EVENT));
}

/**
 * Check in the background whether the cached list is still current, replacing
 * it and firing FOODS_CHANGED_EVENT only if it is not. Cheap enough to call
 * freely — it self-throttles to PROBE_INTERVAL_MS and de-dupes concurrent
 * runs. Pass `force` to skip the throttle (e.g. an explicit user refresh).
 */
export function revalidateFoods(opts: { force?: boolean } = {}): void {
  if (typeof window === "undefined") return;
  const cache = readCache();
  // Nothing cached: loadFoods() is already doing (or about to do) a full fetch.
  if (!cache) return;
  if (!opts.force && Date.now() - lastProbeAt() < PROBE_INTERVAL_MS) return;
  if (revalidating) return;
  revalidating = runRevalidate(cache.stamp)
    .catch(() => {
      /* offline / transient — next call retries */
    })
    .finally(() => {
      revalidating = null;
    });
}

/**
 * The cached food list, returned INSTANTLY whenever one exists.
 *
 * There is no TTL any more. The old 2h expiry re-downloaded all ~2,900 rows on
 * a timer whether or not anything had changed, and STILL left users up to two
 * hours behind an admin sheet-sync — it paid the bandwidth without buying the
 * freshness. Now the cache is kept until the server says it is stale: a
 * ~100-byte stamp probe runs in the background, and only a changed stamp
 * triggers the full fetch, after which FOODS_CHANGED_EVENT re-renders useFoods.
 *
 * Falls back to DEFAULT_FOODS only when there is no cache and the DB returns
 * nothing (cold start while offline / first run).
 */
export async function loadFoods(): Promise<FoodEntry[]> {
  const cache = readCache();
  if (cache) {
    revalidateFoods();
    return cache.entries;
  }

  // Cold start. Read the stamp BEFORE the rows, deliberately: if a sync lands
  // between the two calls we store a stamp OLDER than the rows we got, so the
  // next probe sees a difference and re-fetches. The opposite order would
  // store a stamp newer than the data and the cache would never self-correct.
  const stamp = await fetchFoodsStamp();
  const entries = await fetchAllFoods();
  if (!entries.length) return DEFAULT_FOODS;
  writeCache(entries, stamp);
  markProbed();
  return entries;
}

// Lookup a single food by scanned barcode. Cache-first (instant if cached
// foods are already loaded), then Supabase by exact match on the normalized
// barcode. Returns null when nothing matches.
export async function findFoodByBarcode(
  rawCode: string,
): Promise<FoodEntry | null> {
  const code = normalizeBarcode(rawCode);
  if (!code) return null;

  // 1) Cache check — avoids a round-trip when loadFoods already populated
  //    localStorage. A stale cache is acceptable here: a barcode moving
  //    between foods is extremely rare, and we fall through to the DB anyway.
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
