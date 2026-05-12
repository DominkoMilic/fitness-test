import type { MealKey } from "./database";

export type FoodEntry = {
  id: number | string;
  name: string;
  kcal: number;
  p: number;
  u: number;
  m: number;
  piece_g?: number;
  piece_label?: string;
  has_cup?: boolean;
  has_spoons?: boolean;
};

export type PieceInfo = { g: number; label: string };

export type DailyTotals = {
  kcal: number;
  p: number;
  u: number;
  m: number;
};

export type MealFilter = MealKey | "sve";

export type ToastMsg = { id: number; text: string };
