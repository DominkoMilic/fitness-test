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

export async function updateFavorite(
  id: number,
  userId: string | undefined,
  patch: Partial<Omit<FavoriteInsert, "user_id">>,
) {
  let query = supabase.from("favorites").update(patch).eq("id", id);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.select();
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      "Spremanje nije uspjelo (0 redaka ažurirano — provjeri RLS / vlasništvo).",
    );
  }
  return data[0] as FavoriteRow;
}
