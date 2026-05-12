import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";
import type { FavoriteInsert, FavoriteItem } from "@/types/database";

type RouteCtx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sanitizeItem(raw: unknown): FavoriteItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== "string") return null;
  return {
    name: r.name.trim(),
    grams: Number(r.grams ?? 0),
    kcal: Number(r.kcal ?? 0),
    p: Number(r.p ?? 0),
    u: Number(r.u ?? 0),
    m: Number(r.m ?? 0),
    pieces: r.pieces == null ? null : Number(r.pieces),
  };
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);
  if (id == null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: Partial<FavoriteInsert>;
  try {
    body = (await req.json()) as Partial<FavoriteInsert>;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: Partial<FavoriteInsert> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.meal === "string") patch.meal = body.meal as FavoriteInsert["meal"];
  if (Array.isArray(body.items)) {
    const items: FavoriteItem[] = [];
    for (const it of body.items) {
      const sane = sanitizeItem(it);
      if (sane) items.push(sane);
    }
    patch.items = items;
  }
  if (typeof body.total_kcal === "number") patch.total_kcal = body.total_kcal;
  if (typeof body.total_p === "number") patch.total_p = body.total_p;
  if (typeof body.total_u === "number") patch.total_u = body.total_u;
  if (typeof body.total_m === "number") patch.total_m = body.total_m;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "No fields" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("favorites")
    .update(patch)
    .eq("id", id)
    .eq("user_id", uid)
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: data[0] });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);
  if (id == null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from("favorites")
    .delete()
    .eq("id", id)
    .eq("user_id", uid);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
