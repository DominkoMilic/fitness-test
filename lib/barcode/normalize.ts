// Normalize raw barcode strings before lookup/dedupe.
//
// - Strips whitespace and non-digit chars.
// - Promotes 12-digit UPC-A to EAN-13 by prepending a leading zero
//   (Open Food Facts treats them as EAN-13).
// - Leaves valid EAN-13 (13 digits) and other lengths untouched
//   (EAN-8 = 8, ITF-14 = 14, etc.).
export function normalizeBarcode(code: string): string {
  if (!code) return "";
  const digits = String(code).trim().replace(/\D/g, "");
  if (digits.length === 12) return "0" + digits;
  return digits;
}
