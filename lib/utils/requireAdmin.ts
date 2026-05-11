import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "./adminSession";

/**
 * Returns a 401 NextResponse if the request is not a valid admin session,
 * or `null` if the caller may proceed. Use in admin API route handlers:
 *
 *   const guard = await requireAdmin();
 *   if (guard) return guard;
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const ok = await verifyAdminSession(token);
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
