import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";

export async function PATCH(req: Request) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  let body: { goal?: unknown };
  try {
    body = (await req.json()) as { goal?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const goal = typeof body.goal === "number" ? body.goal : NaN;
  if (!Number.isFinite(goal) || goal < 0 || goal > 100000) {
    return NextResponse.json({ error: "Invalid goal" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from("codes")
    .update({ goal: Math.round(goal) })
    .eq("id", uid);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
