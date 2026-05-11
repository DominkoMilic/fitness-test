import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/utils/adminSession";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const ok = await verifyAdminSession(token);
  // No-cache so logout/login flips are observed immediately.
  return NextResponse.json(
    { ok },
    { headers: { "Cache-Control": "no-store" } },
  );
}
