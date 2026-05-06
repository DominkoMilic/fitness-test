// Lowercases + strips Croatian diacritics for fuzzy search matching.
const COMBINING_MARKS = /[̀-ͯ]/g;

export function normalizeForSearch(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d");
}
