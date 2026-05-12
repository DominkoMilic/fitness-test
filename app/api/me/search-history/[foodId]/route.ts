import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";

type RouteCtx = { params: Promise<{ foodId: string }> };

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  const { foodId: rawId } = await ctx.params;
  const foodId = parseInt(rawId, 10);
  if (!Number.isFinite(foodId) || foodId <= 0) {
    return NextResponse.json({ error: "Invalid foodId" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from("search_history")
    .delete()
    .eq("user_id", uid)
    .eq("food_id", foodId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
