import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/utils/requireAdmin";
import type { AccessCodeInsert } from "@/types/database";

export async function GET() {
  const guard = await requireAdmin();
  if (guard) return guard;

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard) return guard;

  let body: AccessCodeInsert;
  try {
    body = (await req.json()) as AccessCodeInsert;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body || typeof body.code !== "string" || !body.code.trim()) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("codes")
    .insert(body)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ data });
}
