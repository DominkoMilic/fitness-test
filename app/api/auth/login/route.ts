import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  USER_COOKIE_NAME,
  USER_COOKIE_TTL,
  signUserSession,
} from "@/lib/utils/userSession";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  let body: { code?: unknown };
  try {
    body = (await req.json()) as { code?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("codes")
    .select("*")
    .eq("code", code)
    .gte("exp", todayISO())
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const user = data?.[0];
  if (!user) {
    return NextResponse.json(
      { error: "Pristupni kod nije valjan ili je istekao" },
      { status: 401 },
    );
  }

  const token = await signUserSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: USER_COOKIE_TTL,
  });

  return NextResponse.json({ user });
}
