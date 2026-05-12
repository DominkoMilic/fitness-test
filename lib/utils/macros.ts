import type { FoodEntry, PieceInfo } from "@/types/app";
import type { FoodLogRow } from "@/types/database";
import { PIECE_UNITS } from "@/lib/constants/pieces";
import {
  EXTRA_UNIT_G,
  EXTRA_UNIT_FORMS,
  type ExtraUnit,
} from "@/lib/constants/extraUnits";
import { croatianPlural } from "./croatianPlural";

export type AmountUnit = "g" | "kom" | ExtraUnit;

export function getPieceInfo(food: FoodEntry | null | undefined): PieceInfo | null {
  if (!food) return null;
  if (food.piece_g && food.piece_label) {
    return { g: Number(food.piece_g), label: food.piece_label };
  }
  return PIECE_UNITS[food.id as number] || null;
}

export function isExtraUnit(unit: AmountUnit): unit is ExtraUnit {
  return unit === "salica" || unit === "jusna_zlica" || unit === "cajna_zlica";
}

export function effectiveGrams(
  inputValue: number,
  unit: AmountUnit,
  food: FoodEntry | null,
  editPieceG: number | null,
): number {
  if (unit === "kom") {
    if (editPieceG) return inputValue * editPieceG;
    const pu = getPieceInfo(food);
    if (pu) return inputValue * pu.g;
    return inputValue;
  }
  if (isExtraUnit(unit)) {
    return inputValue * EXTRA_UNIT_G[unit];
  }
  return inputValue;
}

/** "2 šalice", "1 čajna žlica", "3 jušne žlice" */
export function formatExtraUnitAmount(count: number, unit: ExtraUnit): string {
  const f = EXTRA_UNIT_FORMS[unit];
  const noun = croatianPlural(count, f.singular, f.paucal, f.plural);
  const num = Number.isInteger(count)
    ? String(count)
    : String(Math.round(count * 10) / 10);
  return `${num} ${noun}`;
}

/**
 * Given total grams and a food, return a friendly amount label. Preference:
 *   1. pieces explicit (caller passes pieces non-null) → "X kom"
 *   2. food supports šalica (has_cup) and grams divides cleanly  → "X šalica"
 *   3. food supports žlice (has_spoons) → largest matching spoon
 *   4. fallback → "Xg"
 *
 * Cleanly-divides means `grams / unit_g` is an integer or half-step ≥ 1.
 */
export function describeAmount(
  grams: number,
  pieces: number | null,
  food: FoodEntry | null | undefined,
): string {
  if (pieces != null) return `${pieces} kom`;

  const candidates: ExtraUnit[] = [];
  if (food?.has_cup) candidates.push("salica");
  if (food?.has_spoons) candidates.push("jusna_zlica", "cajna_zlica");

  for (const u of candidates) {
    const g = EXTRA_UNIT_G[u];
    const count = grams / g;
    if (Math.abs(count - Math.round(count * 2) / 2) < 1e-6 && count >= 1) {
      const rounded = Math.round(count * 2) / 2;
      return formatExtraUnitAmount(rounded, u);
    }
  }

  return `${Math.round(grams)} g`;
}

export function macroForGrams(food: FoodEntry, grams: number) {
  const r = grams / 100;
  return {
    kcal: round1(food.kcal * r),
    p: round1(food.p * r),
    u: round1(food.u * r),
    m: round1(food.m * r),
  };
}

export function sumLogs(logs: FoodLogRow[]) {
  return logs.reduce(
    (acc, l) => {
      acc.kcal += Number(l.kcal) || 0;
      acc.p += Number(l.p) || 0;
      acc.u += Number(l.u) || 0;
      acc.m += Number(l.m) || 0;
      return acc;
    },
    { kcal: 0, p: 0, u: 0, m: 0 },
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;
