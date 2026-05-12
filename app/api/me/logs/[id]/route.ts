import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";
import type { FoodLogInsert } from "@/types/database";

type RouteCtx = { params: Promise<{ id: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: RouteCtx) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("food_logs")
    .select("*")
    .eq("id", id)
    .eq("user_id", uid)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data?.[0] ?? null });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: Partial<FoodLogInsert>;
  try {
    body = (await req.json()) as Partial<FoodLogInsert>;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Whitelist mutable fields; ignore user_id from body entirely.
  const patch: Partial<FoodLogInsert> = {};
  if (typeof body.meal === "string") patch.meal = body.meal as FoodLogInsert["meal"];
  if (typeof body.food_name === "string")
    patch.food_name = body.food_name.trim();
  if (typeof body.grams === "number") patch.grams = body.grams;
  if (typeof body.kcal === "number") patch.kcal = body.kcal;
  if (typeof body.p === "number") patch.p = body.p;
  if (typeof body.u === "number") patch.u = body.u;
  if (typeof body.m === "number") patch.m = body.m;
  if (body.pieces === null) patch.pieces = null;
  else if (typeof body.pieces === "number") patch.pieces = body.pieces;
  if (typeof body.date === "string") patch.date = body.date;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "No fields" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("food_logs")
    .update(patch)
    .eq("id", id)
    .eq("user_id", uid)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from("food_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", uid);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
