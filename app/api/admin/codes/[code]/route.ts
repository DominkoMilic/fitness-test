import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/utils/requireAdmin";

type CodeUpdate = {
  exp?: string;
  goal?: number;
  name?: string;
};

type RouteCtx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const { code } = await ctx.params;
  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("codes")
    .select("*")
    .eq("code", code)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data?.[0] ?? null });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const { code } = await ctx.params;
  let body: CodeUpdate;
  try {
    body = (await req.json()) as CodeUpdate;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: CodeUpdate = {};
  if (typeof body.exp === "string") patch.exp = body.exp;
  if (typeof body.goal === "number" && Number.isFinite(body.goal))
    patch.goal = body.goal;
  if (typeof body.name === "string") patch.name = body.name.trim();

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("codes")
    .update(patch)
    .eq("code", code)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const { code } = await ctx.params;
  const supa = getSupabaseAdmin();
  const { error } = await supa.from("codes").delete().eq("code", code);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
