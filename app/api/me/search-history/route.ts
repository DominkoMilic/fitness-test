import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";

export async function GET() {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("search_history")
    .select("*")
    .eq("user_id", uid)
    .order("last_searched_at", { ascending: false })
    .limit(15);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  let body: { foodId?: unknown; grams?: unknown; pieces?: unknown };
  try {
    body = (await req.json()) as {
      foodId?: unknown;
      grams?: unknown;
      pieces?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const foodId = Number(body.foodId);
  const grams = Number(body.grams);
  if (!Number.isFinite(foodId) || foodId <= 0) {
    return NextResponse.json({ error: "Invalid foodId" }, { status: 400 });
  }
  if (!Number.isFinite(grams) || grams < 0) {
    return NextResponse.json({ error: "Invalid grams" }, { status: 400 });
  }
  const pieces =
    body.pieces == null
      ? null
      : Number.isFinite(Number(body.pieces))
        ? Number(body.pieces)
        : null;

  const supa = getSupabaseAdmin();
  const { error } = await supa.from("search_history").upsert(
    {
      user_id: uid,
      food_id: foodId,
      grams,
      pieces,
      last_searched_at: new Date().toISOString(),
    },
    { onConflict: "user_id,food_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from("search_history")
    .delete()
    .eq("user_id", uid);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
