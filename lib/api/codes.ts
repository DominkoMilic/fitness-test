import { supabase } from "@/lib/supabase/client";
import { todayISO } from "@/lib/utils/date";
import type { AccessCodeInsert, AccessCodeRow } from "@/types/database";

export async function loginWithCode(
  code: string,
): Promise<AccessCodeRow | null> {
  const today = todayISO();
  const { data, error } = await supabase
    .from("codes")
    .select("*")
    .eq("code", code)
    .gte("exp", today)
    .limit(1);
  if (error || !data?.length) return null;
  return data[0];
}

export async function listCodes(): Promise<AccessCodeRow[]> {
  const { data } = await supabase
    .from("codes")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getCodeByValue(
  code: string,
): Promise<AccessCodeRow | null> {
  const { data, error } = await supabase
    .from("codes")
    .select("*")
    .eq("code", code)
    .limit(1);
  if (error || !data?.length) return null;
  return data[0];
}

export async function createCode(input: AccessCodeInsert) {
  const { data, error } = await supabase
    .from("codes")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCode(code: string) {
  await supabase.from("codes").delete().eq("code", code);
}

export async function updateGoal(code: string, goal: number) {
  await supabase.from("codes").update({ goal }).eq("code", code);
}
