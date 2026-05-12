import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";
import type { FavoriteInsert, FavoriteItem } from "@/types/database";

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

export async function GET() {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("favorites")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  let body: Partial<FavoriteInsert>;
  try {
    body = (await req.json()) as Partial<FavoriteInsert>;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const itemsIn = Array.isArray(body.items) ? body.items : [];
  const items: FavoriteItem[] = [];
  for (const it of itemsIn) {
    const sane = sanitizeItem(it);
    if (sane) items.push(sane);
  }

  const fav: FavoriteInsert = {
    user_id: uid,
    name: String(body.name ?? "").trim(),
    meal: body.meal as FavoriteInsert["meal"],
    items,
    total_kcal: Number(body.total_kcal ?? 0),
    total_p: Number(body.total_p ?? 0),
    total_u: Number(body.total_u ?? 0),
    total_m: Number(body.total_m ?? 0),
  };

  if (!fav.name || !fav.meal || !items.length) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("favorites")
    .insert(fav)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ data });
}
