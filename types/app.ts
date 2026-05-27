import type { MealKey } from "./database";

export type FoodEntry = {
  id: number | string;
  name: string;
  // Diacritic-stripped, lowercased, space-collapsed version of `name`.
  // Sourced from foods.normalized_name; computed on demand by the search
  // service when missing (DEFAULT_FOODS / locally-added scanner results).
  normalizedName?: string;
  kcal: number;
  p: number;
  u: number;
  m: number;
  piece_g?: number;
  piece_label?: string;
  has_cup?: boolean;
  has_spoons?: boolean;
  // Digits-only EAN/UPC. Present when admin set "Bar kod" in sheet.
  barcode?: string;
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
