import "server-only";
import { tokenize } from "@/lib/utils/normalize";

// Pure text helpers shared by the foods index (which precomputes stems for
// every row) and the matcher (which stems the model's item names). Kept in
// their own module so neither has to import the other.

// Croatian/English filler words. They carry no identity ("umak OD rajčice"
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
export function contentStems(normalized: string): string[] {
  const cleaned = normalized.replace(/[^\p{L}\p{N}\s]+/gu, " ");
  const out: string[] = [];
  for (const t of tokenize(cleaned)) {
    if (t.length < 2 || STOPWORDS.has(t)) continue;
    const s = stem(t);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}
