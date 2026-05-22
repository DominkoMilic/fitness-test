// Croatian-friendly normalization for fuzzy food search.
//
// Single source of truth — mirrored in DB by public.kf_normalize_name
// (see db/migrations/2026-05-22_foods-normalized-name.sql). Keep both in
// sync if changing rules.
//
// Rules (in order):
//   1. lowercase
//   2. NFD decompose + strip combining marks (č→c, ć→c, š→s, ž→z, ñ→n, …)
//   3. đ → d (NFD does not decompose đ)
//   4. trim outer whitespace
//   5. collapse internal whitespace to single space
//
// Examples:
//   "Pileća Prsa"  → "pileca prsa"
//   "Ćevapi"       → "cevapi"
//   "Šunka  s   sirom" → "sunka s sirom"
//   "Đuveč"        → "duvec"

const COMBINING_MARKS = /[̀-ͯ]/g;

export function normalizeForSearch(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d")
    .trim()
    .replace(/\s+/g, " ");
}

// Splits a normalized query into searchable tokens (drops empties).
// Used by Fuse-based token search so word order does not matter.
export function tokenize(normalized: string): string[] {
  if (!normalized) return [];
  return normalized.split(" ").filter((t) => t.length > 0);
}
