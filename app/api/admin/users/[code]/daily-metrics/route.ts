import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/utils/requireAdmin";
import type { DailyMetricsApi } from "@/types/database";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDate = (v: string | null | undefined): v is string =>
  Boolean(v && ISO_DATE_RE.test(v));

type RouteCtx = { params: Promise<{ code: string }> };

export async function GET(req: Request, ctx: RouteCtx) {
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

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const hasRange = from || to;

  if (hasRange && (!isIsoDate(from) || !isIsoDate(to))) {
    return NextResponse.json(
      { error: "from/to required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }
  if (hasRange && from! > to!) {
    return NextResponse.json(
      { error: "from must be <= to" },
      { status: 400 },
    );
  }

  // All-time weight history (sparse, ASC).
  if (!hasRange) {
    const { data: rows, error } = await supa
      .from("daily_metrics")
      .select("date, weight_kg, steps")
      .eq("user_id", uid)
      .not("weight_kg", "is", null)
      .order("date", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const data: DailyMetricsApi[] = (rows ?? []).map((r) => ({
      date: r.date,
      weight_kg: r.weight_kg == null ? null : Number(r.weight_kg),
      steps: r.steps == null ? null : Number(r.steps),
      kcal: 0,
    }));
    return NextResponse.json({ data });
  }

  // Range mode: dense day-by-day with kcal sums from food_logs.
  const [metricsRes, logsRes] = await Promise.all([
    supa
      .from("daily_metrics")
      .select("date, weight_kg, steps")
      .eq("user_id", uid)
      .gte("date", from!)
      .lte("date", to!),
    supa
      .from("food_logs")
      .select("date, kcal")
      .eq("user_id", uid)
      .gte("date", from!)
      .lte("date", to!),
  ]);
  if (metricsRes.error) {
    return NextResponse.json(
      { error: metricsRes.error.message },
      { status: 500 },
    );
  }
  if (logsRes.error) {
    return NextResponse.json({ error: logsRes.error.message }, { status: 500 });
  }

  const kcalByDate = new Map<string, number>();
  for (const row of logsRes.data ?? []) {
    const prev = kcalByDate.get(row.date) ?? 0;
    kcalByDate.set(row.date, prev + (Number(row.kcal) || 0));
  }

  const metricByDate = new Map<
    string,
    { weight_kg: number | null; steps: number | null }
  >();
  for (const row of metricsRes.data ?? []) {
    metricByDate.set(row.date, {
      weight_kg: row.weight_kg == null ? null : Number(row.weight_kg),
      steps: row.steps == null ? null : Number(row.steps),
    });
  }

  const data: DailyMetricsApi[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (
    let d = new Date(start);
    d.getTime() <= end.getTime();
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const iso = d.toISOString().slice(0, 10);
    const m = metricByDate.get(iso);
    data.push({
      date: iso,
      weight_kg: m?.weight_kg ?? null,
      steps: m?.steps ?? null,
      kcal: Math.round(kcalByDate.get(iso) ?? 0),
    });
  }

  return NextResponse.json({ data });
}
