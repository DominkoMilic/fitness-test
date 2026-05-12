import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("codes")
    .select("*")
    .eq("id", uid)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const user = data?.[0];
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 401 });
  }
  // Expired code → treat as unauthenticated. Don't clear cookie here so a
  // future code extension by admin doesn't require user re-login.
  if (user.exp < todayISO()) {
    return NextResponse.json({ error: "Code expired" }, { status: 401 });
  }

  return NextResponse.json(
    { user },
    { headers: { "Cache-Control": "no-store" } },
  );
}
