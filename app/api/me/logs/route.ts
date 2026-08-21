import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";
import type { FoodLogInsert } from "@/types/database";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  const date = new URL(req.url).searchParams.get("date") || "";
  if (!ISO_DATE.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("food_logs")
    .select("*")
    .eq("user_id", uid)
    .eq("date", date)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  let body: Partial<FoodLogInsert>;
  try {
    body = (await req.json()) as Partial<FoodLogInsert>;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Server overrides user_id from cookie; client value is ignored.
  const entry: FoodLogInsert = {
    user_id: uid,
    date: String(body.date ?? ""),
    meal: body.meal as FoodLogInsert["meal"],
    food_name: String(body.food_name ?? "").trim(),
    grams: Number(body.grams ?? 0),
    kcal: Number(body.kcal ?? 0),
    p: Number(body.p ?? 0),
    u: Number(body.u ?? 0),
    m: Number(body.m ?? 0),
    pieces: body.pieces == null ? null : Number(body.pieces),
    source: body.source === "ai" ? "ai" : "manual",
    ai_analysis_id:
      body.ai_analysis_id == null ? null : String(body.ai_analysis_id),
  };

  if (!ISO_DATE.test(entry.date) || !entry.meal || !entry.food_name) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("food_logs")
    .insert(entry)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Bump streak server-side (RPC will be revoked from anon in migration).
  await supa.rpc("bump_streak", { p_user_id: uid });

  return NextResponse.json({ data });
}
