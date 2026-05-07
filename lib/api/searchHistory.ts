import { supabase } from "@/lib/supabase/client";

export type SearchHistoryRow = {
  user_id: string;
  food_id: number;
  last_searched_at: string;
};

export async function listSearchHistory(
  userId: string,
): Promise<SearchHistoryRow[]> {
  const { data, error } = await supabase
    .from("search_history")
    .select("*")
    .eq("user_id", userId)
    .order("last_searched_at", { ascending: false })
    .limit(15);
  if (error) throw error;
  return data ?? [];
}

export async function pushSearchHistory(userId: string, foodId: number) {
  const { error } = await supabase.from("search_history").upsert(
    {
      user_id: userId,
      food_id: foodId,
      last_searched_at: new Date().toISOString(),
    },
    { onConflict: "user_id,food_id" },
  );
  if (error) throw error;
}

export async function removeSearchHistoryItem(userId: string, foodId: number) {
  const { error } = await supabase
    .from("search_history")
    .delete()
    .eq("user_id", userId)
    .eq("food_id", foodId);
  if (error) throw error;
}

export async function clearSearchHistory(userId: string) {
  const { error } = await supabase
    .from("search_history")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}
