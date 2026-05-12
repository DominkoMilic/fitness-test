// Supabase DB row types — keep in sync with schema.
// Replace via `supabase gen types typescript` once CLI configured.

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
      search_history: {
        Row: SearchHistoryDbRow;
        Insert: SearchHistoryDbInsert;
        Update: Partial<SearchHistoryDbInsert>;
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
};

export type FoodRow = {
  id: number;
  name: string;
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
  "id" | "created_at" | "has_cup" | "has_spoons"
> & {
  id?: number;
  created_at?: string;
  has_cup?: boolean;
  has_spoons?: boolean;
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
  created_at: string;
};
export type FoodLogInsert = Omit<FoodLogRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type FavoriteItem = {
  name: string;
  grams: number;
  kcal: number;
  p: number;
  u: number;
  m: number;
  pieces: number | null;
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
