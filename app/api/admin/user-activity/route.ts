import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/utils/requireAdmin";

export async function GET() {
  const guard = await requireAdmin();
  if (guard) return guard;

  const supa = getSupabaseAdmin();
  const { data, error } = await supa.from("user_activity_view").select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}
