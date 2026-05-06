import { supabase } from "@/lib/supabase/client";
import type { FoodLogInsert, FoodLogRow } from "@/types/database";

export async function listLogs(
  userId: string,
  date: string,
): Promise<FoodLogRow[]> {
  const { data } = await supabase
    .from("food_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getLog(id: string): Promise<FoodLogRow | null> {
  const { data } = await supabase
    .from("food_logs")
    .select("*")
    .eq("id", id)
    .limit(1);
  return data?.[0] ?? null;
}

export async function insertLog(entry: FoodLogInsert) {
  const { data, error } = await supabase
    .from("food_logs")
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function insertLogs(entries: FoodLogInsert[]) {
  if (!entries.length) return [];
  const { data, error } = await supabase
    .from("food_logs")
    .insert(entries)
    .select();
  if (error) throw error;
  return data ?? [];
}

export async function updateLog(id: string, patch: Partial<FoodLogInsert>) {
  const { data, error } = await supabase
    .from("food_logs")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLog(id: string) {
  await supabase.from("food_logs").delete().eq("id", id);
}
