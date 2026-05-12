import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/utils/requireAdmin";

type RouteCtx = { params: Promise<{ code: string }> };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request, ctx: RouteCtx) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const { code } = await ctx.params;
  const date = new URL(req.url).searchParams.get("date") || "";
  if (!ISO_DATE.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

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
    .from("food_logs")
    .select("*")
    .eq("user_id", uid)
    .eq("date", date)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
