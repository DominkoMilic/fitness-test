import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";

export async function POST() {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  const supa = getSupabaseAdmin();
  const { data, error } = await supa.rpc("bump_streak", { p_user_id: uid });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ data: row ?? null });
}
