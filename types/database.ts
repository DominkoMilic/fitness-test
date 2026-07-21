// Supabase DB row types — keep in sync with schema.
// Replace via `supabase gen types typescript` once CLI configured.

// Type-only import (cycle with app.ts is fine — erased at compile time).
import type { AiAnalysisItem, AiConfidence } from "./app";

export type Database = {
  public: {
    Tables: {
      codes: {
        Row: AccessCodeRow;
        Insert: AccessCodeInsert;
        Update: Partial<AccessCodeInsert>;
        Relationships: [];
      };
      foods: {
        Row: FoodRow;
        Insert: FoodInsert;
        Update: Partial<FoodInsert>;
        Relationships: [];
      };
      food_logs: {
        Row: FoodLogRow;
        Insert: FoodLogInsert;
        Update: Partial<FoodLogInsert>;
        Relationships: [];
      };
      favorites: {
        Row: FavoriteRow;
        Insert: FavoriteInsert;
        Update: Partial<FavoriteInsert>;
        Relationships: [];
      };
      recipes: {
        Row: RecipeRow;
        Insert: RecipeInsert;
        Update: Partial<RecipeInsert>;
        Relationships: [];
      };
      search_history: {
        Row: SearchHistoryDbRow;
        Insert: SearchHistoryDbInsert;
        Update: Partial<SearchHistoryDbInsert>;
        Relationships: [];
      };
      daily_metrics: {
        Row: DailyMetricsRow;
        Insert: DailyMetricsInsert;
        Update: Partial<DailyMetricsInsert>;
        Relationships: [];
      };
      ai_meal_analyses: {
        Row: AiMealAnalysisRow;
        Insert: AiMealAnalysisInsert;
        Update: Partial<AiMealAnalysisInsert>;
        Relationships: [];
      };
      ai_usage: {
        Row: AiUsageRow;
        Insert: AiUsageInsert;
        Update: Partial<AiUsageInsert>;
        Relationships: [];
      };
    };
    Views: {
      user_activity_view: {
        Row: UserActivityRow;
        Relationships: [];
      };
    };
    Functions: {
      bump_streak: {
        Args: {
          p_user_id: string;
        };
        Returns: {
          current_streak: number | null;
          last_upload_date: string | null;
        }[];
      };
      bump_ai_usage: {
        Args: {
          p_user_id: string;
          p_date: string;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type AccessCodeRow = {
  id: string;
  code: string;
  name: string;
  exp: string; // YYYY-MM-DD
  goal: number;
  cookies_accepted_at: string | null;
  current_streak: number;
  last_upload_at: string | null;
  last_upload_date: string | null;
  created_at: string | null;
};
export type AccessCodeInsert = Omit<
  AccessCodeRow,
  | "id"
  | "created_at"
  | "cookies_accepted_at"
  | "current_streak"
  | "last_upload_at"
  | "last_upload_date"
> & {
  id?: string;
  created_at?: string;
  cookies_accepted_at?: string | null;
  current_streak?: number;
  last_upload_at?: string | null;
  last_upload_date?: string | null;
};

export type ActivityStatus = "active" | "yellow" | "red";

export type UserActivityRow = {
  id: string;
  code: string;
  name: string;
  exp: string;
  goal: number;
  current_streak: number;
  last_upload_at: string | null;
  last_upload_date: string | null;
  inactivity_days: number | null;
  activity_status: ActivityStatus;
  created_at: string | null;
};

export type FoodRow = {
  id: number;
  name: string;
  normalized_name: string;
  barcode: string | null;
  category: string | null;
  kcal_per_100g: number;
  protein: number;
  carbs: number;
  fat: number;
  piece_name: string | null;
  piece_weight_g: number | null;
  status: "imported" | "new" | "archived";
  added_by: string | null;
  sheet_row_id: string | null;
  has_cup: boolean;
  has_spoons: boolean;
  created_at: string;
};
export type FoodInsert = Omit<
  FoodRow,
  "id" | "created_at" | "has_cup" | "has_spoons" | "normalized_name"
> & {
  id?: number;
  created_at?: string;
  has_cup?: boolean;
  has_spoons?: boolean;
  // Optional in TS — DB trigger fills it if omitted. Service layer still
  // sets it explicitly so cached rows always have it.
  normalized_name?: string;
};

export type FoodLogRow = {
  id: string;
  user_id: string;
  date: string;
  meal: MealKey;
  food_name: string;
  grams: number;
  kcal: number;
  p: number;
  u: number;
  m: number;
  pieces: number | null;
  // Recipe grouping: rows sharing a group_id were added together from one
  // recipe-portion. NULL for ordinary single-food logs. See
  // 2026-06-04_food-logs-recipe-group.sql.
  group_id: string | null;
  group_name: string | null;
  group_portions: number | null;
  // How the entry was created. 'manual' for hand/barcode/recipe entries,
  // 'ai' for Gemini Vision analyses. See 2026-07-21_food-logs-ai-source.sql.
  source: FoodLogSource;
  // Back-link to the ai_meal_analyses row this entry came from (source='ai').
  ai_analysis_id: string | null;
  created_at: string;
};
export type FoodLogSource = "manual" | "ai";
export type FoodLogInsert = Omit<
  FoodLogRow,
  | "id"
  | "created_at"
  | "group_id"
  | "group_name"
  | "group_portions"
  | "source"
  | "ai_analysis_id"
> & {
  id?: string;
  created_at?: string;
  group_id?: string | null;
  group_name?: string | null;
  group_portions?: number | null;
  source?: FoodLogSource;
  ai_analysis_id?: string | null;
};

export type FavoriteItem = {
  name: string;
  grams: number;
  kcal: number;
  p: number;
  u: number;
  m: number;
  pieces: number | null;
  // Unit the user picked when adding this ingredient, so editing restores it.
  // Absent on legacy rows (inferred from `pieces` on read). Matches AmountUnit.
  unit?: "g" | "kom" | "salica" | "jusna_zlica" | "cajna_zlica";
  // Original input value in the chosen unit (e.g. 1 for "1 šalica").
  qty?: number;
};

export type FavoriteRow = {
  id: number;
  user_id: string;
  name: string;
  meal: MealKey;
  items: FavoriteItem[];
  total_kcal: number;
  total_p: number;
  total_u: number;
  total_m: number;
  created_at: string;
};
export type FavoriteInsert = Omit<FavoriteRow, "id" | "created_at"> & {
  id?: number;
  created_at?: string;
};

export type RecipeItem = FavoriteItem;

export type RecipeRow = {
  id: number;
  user_id: string;
  name: string;
  meal: MealKey;
  people: number;
  items: RecipeItem[];
  total_kcal: number;
  total_p: number;
  total_u: number;
  total_m: number;
  created_at: string;
};
export type RecipeInsert = Omit<RecipeRow, "id" | "created_at"> & {
  id?: number;
  created_at?: string;
};

export type MealKey = "dorucak" | "rucak" | "vecera" | "uzina";

export type SearchHistoryDbRow = {
  user_id: string;
  food_id: number;
  grams: number;
  pieces: number | null;
  last_searched_at: string;
};
export type SearchHistoryDbInsert = {
  user_id: string;
  food_id: number;
  grams?: number;
  pieces?: number | null;
  last_searched_at?: string;
};

export type DailyMetricsRow = {
  id: number;
  user_id: string;
  date: string;
  weight_kg: number | null;
  steps: number | null;
  created_at: string;
  updated_at: string;
};
export type DailyMetricsInsert = {
  user_id: string;
  date: string;
  weight_kg?: number | null;
  steps?: number | null;
  updated_at?: string;
};

// API row — daily_metrics joined with computed kcal sum from food_logs.
export type DailyMetricsApi = {
  date: string;
  weight_kg: number | null;
  steps: number | null;
  kcal: number;
};

// AI meal analysis persisted for later review. `items` holds AiAnalysisItem[]
// (see types/app.ts). See 2026-07-21_ai-meal-analyses.sql.
export type AiMealAnalysisRow = {
  id: string;
  user_id: string;
  date: string;
  meal: MealKey | null;
  title: string;
  items: AiAnalysisItem[];
  total_kcal: number;
  total_p: number;
  total_u: number;
  total_m: number;
  kcal_min: number | null;
  kcal_max: number | null;
  confidence: AiConfidence;
  model: string;
  created_at: string;
};
export type AiMealAnalysisInsert = Omit<
  AiMealAnalysisRow,
  "id" | "created_at"
> & {
  id?: string;
  created_at?: string;
};

export type AiUsageRow = {
  user_id: string;
  date: string;
  count: number;
};
export type AiUsageInsert = AiUsageRow;
