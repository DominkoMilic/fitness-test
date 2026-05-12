import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { USER_COOKIE_NAME, verifyUserSession } from "./userSession";

export type UserGuard = { uid: string };

/**
 * Returns either `{ uid }` if the request has a valid user session cookie,
 * or a 401 NextResponse the route handler should return immediately.
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
  return session;
}
