import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";
import { USER_COOKIE_NAME } from "@/lib/utils/userSession";

// GDPR Article 17 — Right to Erasure. Deletes the account row in `codes`;
// food_logs / favorites / search_history cascade via FK ON DELETE CASCADE.
export async function DELETE() {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  const supa = getSupabaseAdmin();

  // Best-effort cleanup of dependent rows in tables that may not have a
  // CASCADE FK (search_history). Codes deletion below cascades food_logs +
  // favorites per scope B migration.
  await supa.from("search_history").delete().eq("user_id", uid);
  await supa.from("food_logs").delete().eq("user_id", uid);
  await supa.from("favorites").delete().eq("user_id", uid);

  const { error } = await supa.from("codes").delete().eq("id", uid);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clear session cookie.
  const cookieStore = await cookies();
  cookieStore.delete(USER_COOKIE_NAME);

  return NextResponse.json({ ok: true });
}
