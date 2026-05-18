import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";
import type { DailyMetricsApi } from "@/types/database";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(v: string | null | undefined): v is string {
  return Boolean(v && ISO_DATE_RE.test(v));
}

function nullableNumber(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function nullableInt(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: Request) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!isIsoDate(from) || !isIsoDate(to)) {
    return NextResponse.json(
      { error: "from/to required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }
  if (from > to) {
    return NextResponse.json(
      { error: "from must be <= to" },
      { status: 400 },
    );
  }

  const supa = getSupabaseAdmin();

  const [metricsRes, logsRes] = await Promise.all([
    supa
      .from("daily_metrics")
      .select("date, weight_kg, steps")
      .eq("user_id", uid)
      .gte("date", from)
      .lte("date", to),
    supa
      .from("food_logs")
      .select("date, kcal")
      .eq("user_id", uid)
      .gte("date", from)
      .lte("date", to),
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
      weight_kg:
        row.weight_kg == null ? null : Number(row.weight_kg),
      steps: row.steps == null ? null : Number(row.steps),
    });
  }

  // Build a continuous, dense range from..to (inclusive) so the client gets
  // an entry for every day even when DB has no row yet.
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

// Upsert weight_kg and/or steps for a single (user, date).
// Body: { date: "YYYY-MM-DD", weight_kg?: number|null, steps?: number|null }
export async function PUT(req: Request) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  let body: {
    date?: string;
    weight_kg?: number | null;
    steps?: number | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const date = body.date;
  if (!isIsoDate(date)) {
    return NextResponse.json(
      { error: "date required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const weight = nullableNumber(body.weight_kg);
  const steps = nullableInt(body.steps);

  if (weight === undefined && steps === undefined) {
    return NextResponse.json({ error: "No fields" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();

  // Read existing row so we only overwrite the fields the caller explicitly
  // sent (partial PUT). Missing fields are preserved.
  const existing = await supa
    .from("daily_metrics")
    .select("weight_kg, steps")
    .eq("user_id", uid)
    .eq("date", date)
    .maybeSingle();
  if (existing.error) {
    return NextResponse.json(
      { error: existing.error.message },
      { status: 500 },
    );
  }

  const next = {
    user_id: uid,
    date,
    weight_kg:
      weight !== undefined ? weight : (existing.data?.weight_kg ?? null),
    steps: steps !== undefined ? steps : (existing.data?.steps ?? null),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supa
    .from("daily_metrics")
    .upsert(next, { onConflict: "user_id,date" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ data });
}
