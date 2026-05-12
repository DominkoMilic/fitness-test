import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";
import type { FoodLogInsert } from "@/types/database";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  let body: { entries?: Partial<FoodLogInsert>[] };
  try {
    body = (await req.json()) as { entries?: Partial<FoodLogInsert>[] };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!Array.isArray(body.entries) || !body.entries.length) {
    return NextResponse.json({ error: "Missing entries" }, { status: 400 });
  }

  const entries: FoodLogInsert[] = [];
  for (const e of body.entries) {
    const entry: FoodLogInsert = {
      user_id: uid,
      date: String(e.date ?? ""),
      meal: e.meal as FoodLogInsert["meal"],
      food_name: String(e.food_name ?? "").trim(),
      grams: Number(e.grams ?? 0),
      kcal: Number(e.kcal ?? 0),
      p: Number(e.p ?? 0),
      u: Number(e.u ?? 0),
      m: Number(e.m ?? 0),
      pieces: e.pieces == null ? null : Number(e.pieces),
    };
    if (!ISO_DATE.test(entry.date) || !entry.meal || !entry.food_name) {
      return NextResponse.json(
        { error: "Invalid fields in one or more entries" },
        { status: 400 },
      );
    }
    entries.push(entry);
  }

  const supa = getSupabaseAdmin();
  const { data, error } = await supa.from("food_logs").insert(entries).select();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  await supa.rpc("bump_streak", { p_user_id: uid });
  return NextResponse.json({ data: data ?? [] });
}
