import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";
import type {
  AiMealAnalysisInsert,
  FoodLogInsert,
  MealKey,
} from "@/types/database";
import type { AiAnalysisItem, AiConfidence } from "@/types/app";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MEALS = new Set<MealKey>(["dorucak", "rucak", "vecera", "uzina"]);
const MAX_ITEMS = 30;
const round1 = (n: number) => Math.round(n * 10) / 10;

// GET /api/me/ai/analyses — recent saved analyses for review (newest first).
export async function GET() {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("ai_meal_analyses")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

type SaveBody = {
  date?: string;
  meal?: string;
  title?: string;
  items?: unknown;
  kcalMin?: number | null;
  kcalMax?: number | null;
  confidence?: string;
  model?: string;
  addToDiary?: boolean;
};

function sanitizeItems(input: unknown): AiAnalysisItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, MAX_ITEMS)
    .map((raw) => {
      const r = (raw ?? {}) as Record<string, unknown>;
      const src = r.source === "db" ? "db" : "ai";
      const matched =
        src === "db" && r.matchedFoodId != null
          ? Number(r.matchedFoodId)
          : null;
      return {
        name: String(r.name ?? "").trim().slice(0, 120),
        grams: Math.max(0, round1(Number(r.grams) || 0)),
        kcal: Math.max(0, round1(Number(r.kcal) || 0)),
        p: Math.max(0, round1(Number(r.p) || 0)),
        u: Math.max(0, round1(Number(r.u) || 0)),
        m: Math.max(0, round1(Number(r.m) || 0)),
        source: src as AiAnalysisItem["source"],
        matchedFoodId: Number.isFinite(matched as number)
          ? (matched as number)
          : null,
      };
    })
    .filter((i) => i.name.length > 0);
}

// POST /api/me/ai/analyses — persist an analysis; optionally add to the diary.
export async function POST(req: Request) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  let body: SaveBody;
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const date = String(body.date ?? "");
  if (!ISO_DATE.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const meal =
    body.meal && MEALS.has(body.meal as MealKey)
      ? (body.meal as MealKey)
      : null;
  const items = sanitizeItems(body.items);
  if (items.length === 0) {
    return NextResponse.json({ error: "Nema stavki za spremanje." }, { status: 400 });
  }
  const addToDiary = Boolean(body.addToDiary);
  if (addToDiary && !meal) {
    return NextResponse.json({ error: "Odaberite obrok." }, { status: 400 });
  }

  const title = String(body.title ?? "").trim().slice(0, 120) || "AI obrok";
  const confidence: AiConfidence =
    body.confidence === "low" || body.confidence === "high"
      ? body.confidence
      : "medium";
  const model = String(body.model ?? "").trim().slice(0, 60) || "gemini";

  // Totals recomputed server-side from the (possibly user-edited) items —
  // never trust client-supplied totals.
  const totals = items.reduce(
    (acc, i) => ({
      kcal: round1(acc.kcal + i.kcal),
      p: round1(acc.p + i.p),
      u: round1(acc.u + i.u),
      m: round1(acc.m + i.m),
    }),
    { kcal: 0, p: 0, u: 0, m: 0 },
  );

  const supa = getSupabaseAdmin();

  const insert: AiMealAnalysisInsert = {
    user_id: uid,
    date,
    meal,
    title,
    items,
    total_kcal: totals.kcal,
    total_p: totals.p,
    total_u: totals.u,
    total_m: totals.m,
    kcal_min: body.kcalMin == null ? null : Math.round(Number(body.kcalMin)),
    kcal_max: body.kcalMax == null ? null : Math.round(Number(body.kcalMax)),
    confidence,
    model,
  };

  const { data: analysis, error: aErr } = await supa
    .from("ai_meal_analyses")
    .insert(insert)
    .select()
    .single();
  if (aErr || !analysis) {
    return NextResponse.json(
      { error: aErr?.message ?? "Spremanje nije uspjelo" },
      { status: 400 },
    );
  }

  if (!addToDiary || !meal) {
    return NextResponse.json({ data: analysis, logs: [] });
  }

  // Add to diary. Multiple items → one collapsed group (reuses recipe
  // grouping); single item → a plain AI row.
  const groupId = items.length > 1 ? randomUUID() : null;
  const entries: FoodLogInsert[] = items.map((i) => ({
    user_id: uid,
    date,
    meal,
    food_name: i.name,
    grams: i.grams,
    kcal: i.kcal,
    p: i.p,
    u: i.u,
    m: i.m,
    pieces: null,
    source: "ai",
    ai_analysis_id: analysis.id,
    group_id: groupId,
    group_name: groupId ? title : null,
    group_portions: groupId ? 1 : null,
  }));

  const { data: logs, error: lErr } = await supa
    .from("food_logs")
    .insert(entries)
    .select();
  if (lErr) {
    return NextResponse.json({ error: lErr.message }, { status: 400 });
  }
  await supa.rpc("bump_streak", { p_user_id: uid });

  return NextResponse.json({ data: analysis, logs: logs ?? [] });
}
