import { supabase } from "@/lib/supabase/client";
import type { FavoriteInsert, FavoriteRow } from "@/types/database";

export async function listFavorites(userId: string): Promise<FavoriteRow[]> {
  const { data } = await supabase
    .from("favorites")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function createFavorite(fav: FavoriteInsert) {
  const { data, error } = await supabase
    .from("favorites")
    .insert(fav)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFavorite(id: number) {
  await supabase.from("favorites").delete().eq("id", id);
}
