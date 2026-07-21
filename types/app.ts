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

// ── AI meal analysis (Gemini Vision) ────────────────────────────────
// Where a recognized item's nutrition came from: "db" = matched a row in
// our `foods` table (values recomputed from the DB for consistency), "ai" =
// the model's own estimate (no DB match).
export type AiItemSource = "db" | "ai";

export type AiConfidence = "low" | "medium" | "high";

// One recognized food within an analysis. kcal/p/u/m are absolute totals for
// `grams` (already scaled), NOT per-100g.
export type AiAnalysisItem = {
  name: string;
  grams: number;
  kcal: number;
  p: number;
  u: number;
  m: number;
  source: AiItemSource;
  // foods.id when source === "db", else null.
  matchedFoodId: number | null;
};

// Full result returned by /api/me/ai/analyze (ephemeral — not yet saved).
export type AiAnalysisResult = {
  title: string;
  confidence: AiConfidence;
  items: AiAnalysisItem[];
  totals: DailyTotals;
  // Approximate kcal range for display ("~500–700 kcal"). Null when the model
  // didn't provide one.
  kcalMin: number | null;
  kcalMax: number | null;
  notes?: string;
  // Which Gemini model actually produced this result (after any fallback).
  model?: string;
};

export type MealFilter = MealKey | "sve";

export type ToastMsg = { id: number; text: string };
