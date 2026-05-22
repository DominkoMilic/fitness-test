import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/utils/requireAdmin";

type RouteCtx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const { code } = await ctx.params;
  const supa = getSupabaseAdmin();
  const codeRow = await supa
    .from("codes")
    .select("id")
    .eq("code", code)
    .limit(1);
  if (codeRow.error) {
    return NextResponse.json({ error: codeRow.error.message }, { status: 500 });
  }
  const uid = codeRow.data?.[0]?.id;
  if (!uid) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data, error } = await supa
    .from("recipes")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
