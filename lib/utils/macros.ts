import type { FoodEntry, PieceInfo } from "@/types/app";
import type { FoodLogRow } from "@/types/database";
import { PIECE_UNITS } from "@/lib/constants/pieces";

export function getPieceInfo(food: FoodEntry | null | undefined): PieceInfo | null {
  if (!food) return null;
  if (food.piece_g && food.piece_label) {
    return { g: Number(food.piece_g), label: food.piece_label };
  }
  return PIECE_UNITS[food.id as number] || null;
}

export function effectiveGrams(
  inputValue: number,
  unit: "g" | "kom",
  food: FoodEntry | null,
  editPieceG: number | null,
): number {
  if (unit === "kom") {
    if (editPieceG) return inputValue * editPieceG;
    const pu = getPieceInfo(food);
    if (pu) return inputValue * pu.g;
  }
  return inputValue;
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
