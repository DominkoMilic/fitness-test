import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { USER_COOKIE_NAME, verifyUserSession } from "./userSession";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type UserGuard = { uid: string };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns either `{ uid }` if the request has a valid user session cookie,
 * or a 401 NextResponse the route handler should return immediately.
 *
 * Also rejects users whose `codes.exp` is in the past — so when admin
 * cancels or shortens a code, in-flight sessions stop being able to mutate
 * data and the client's next /api/auth/me poll forces a logout redirect.
 *
 *   const guard = await requireUser();
 *   if (guard instanceof NextResponse) return guard;
 *   const { uid } = guard;
 */
export async function requireUser(): Promise<UserGuard | NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  const session = await verifyUserSession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("codes")
    .select("id, exp")
    .eq("id", session.uid)
    .limit(1);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const row = data?.[0];
  if (!row) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (row.exp < todayISO()) {
    return NextResponse.json({ error: "Code expired" }, { status: 401 });
  }

  return session;
}
