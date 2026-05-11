import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_TTL,
  signAdminSession,
} from "@/lib/utils/adminSession";

function getExpectedPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "";
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function POST(req: Request) {
  const expected = getExpectedPassword();
  if (!expected) {
    return NextResponse.json(
      { error: "Admin password not configured" },
      { status: 500 },
    );
  }

  let body: { password?: unknown };
  try {
    body = (await req.json()) as { password?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const provided =
    typeof body.password === "string" ? body.password.trim() : "";
  if (!provided || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await signAdminSession();
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE_TTL,
  });

  return NextResponse.json({ ok: true });
}
