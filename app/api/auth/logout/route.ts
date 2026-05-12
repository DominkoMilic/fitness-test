import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { USER_COOKIE_NAME } from "@/lib/utils/userSession";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(USER_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
