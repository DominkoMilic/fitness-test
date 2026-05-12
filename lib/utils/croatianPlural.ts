// Croatian noun pluralization for paucal/genitive split.
// Rules (count = abs(int part)):
//   mod100 == 1 && mod100 != 11      → singular
//   mod100 in {2,3,4} && not 12-14   → paucal
//   else                             → plural (genitive)
//
// For fractional counts (e.g. 2.5) we use the paucal form, which matches
// natural speech ("dva i pol kilograma" → paucal "kilograma" anyway, but
// "2.5 šalice" reads correctly in Croatian).

export function croatianPlural(
  count: number,
  singular: string,
  paucal: string,
  plural: string,
): string {
  if (!Number.isFinite(count)) return plural;
  const abs = Math.abs(count);
  // Fractional → paucal.
  if (abs !== Math.floor(abs)) return paucal;
  const n = Math.floor(abs);
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod10 === 1 && mod100 !== 11) return singular;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return paucal;
  return plural;
}
