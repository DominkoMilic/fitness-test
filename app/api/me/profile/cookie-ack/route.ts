import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";

export async function POST() {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from("codes")
    .update({ cookies_accepted_at: new Date().toISOString() })
    .eq("id", uid);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
