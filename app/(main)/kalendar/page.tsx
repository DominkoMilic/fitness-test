"use client";
import { useMemo, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useUIStore } from "@/store/useUIStore";
import { useDailyMetrics } from "@/hooks/useDailyMetrics";
import { useWeightHistory } from "@/hooks/useWeightHistory";
import { WeekNav } from "@/components/kalendar/WeekNav";
import { DayMetricsCard } from "@/components/kalendar/DayMetricsCard";
import { MetricChart } from "@/components/kalendar/MetricChart";
import { InlineLoading } from "@/components/ui/Loading";
import {
  addDays,
  formatDayShortHR,
  formatLocalISO,
  startOfWeekMonday,
  weekDays,
} from "@/lib/utils/week";

const round1 = (n: number) => Math.round(n * 10) / 10;

function formatKg(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function formatPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${(Math.round(n * 10) / 10).toFixed(1)}%`;
}

// Sparse labels on the all-time chart — first, last, and ~3 inside.
function chartLabels(rows: { date: string }[]): string[] {
  if (rows.length === 0) return [];
  if (rows.length === 1) return [formatDayShortHR(new Date(rows[0]!.date))];
  const anchors = new Set<number>([0, rows.length - 1]);
  const inner = Math.min(3, Math.max(0, rows.length - 2));
  for (let i = 1; i <= inner; i++) {
    anchors.add(Math.round((i * (rows.length - 1)) / (inner + 1)));
  }
  return rows.map((r, i) =>
    anchors.has(i) ? formatDayShortHR(new Date(r.date)) : "",
  );
}

export default function KalendarPage() {
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeekMonday(new Date()),
  );
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const from = formatLocalISO(days[0]!);
  const to = formatLocalISO(days[6]!);
  const todayIso = formatLocalISO(new Date());

  const {
    rows: weekRows,
    loading: weekLoading,
    save,
  } = useDailyMetrics(user?.id, from, to);

  const {
    rows: allRows,
    loading: allLoading,
    refresh: refreshHistory,
  } = useWeightHistory(user?.id);

  const [savingIso, setSavingIso] = useState<string | null>(null);

  const byDate = new Map(weekRows.map((r) => [r.date, r]));

  const goPrev = () => setWeekStart((d) => addDays(d, -7));
  const goNext = () => setWeekStart((d) => addDays(d, 7));
  const goToday = () => setWeekStart(startOfWeekMonday(new Date()));

  const saveField = async (
    iso: string,
    patch: { weight_kg?: number | null; steps?: number | null },
  ) => {
    setSavingIso(iso);
    try {
      await save({ date: iso, ...patch });
      // Weight changes affect the all-time chart + stats block.
      if (patch.weight_kg !== undefined) {
        await refreshHistory();
      }
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Greška pri spremanju";
      showToast(msg);
    } finally {
      setSavingIso(null);
    }
  };

  const stats = useMemo(() => {
    const weights = allRows
      .map((r) => r.weight_kg)
      .filter((v): v is number => v != null);
    if (weights.length === 0) {
      return { first: null, current: null, delta: null, pct: null };
    }
    const first = weights[0]!;
    const current = weights[weights.length - 1]!;
    const delta = round1(current - first);
    const pct = first === 0 ? null : round1(((current - first) / first) * 100);
    return { first, current, delta, pct };
  }, [allRows]);

  const chartPoints = useMemo(() => {
    const labels = chartLabels(allRows);
    return allRows.map((r, i) => ({
      label: labels[i] ?? "",
      value: r.weight_kg,
    }));
  }, [allRows]);

  // Weekly arithmetic means — divide by the number of days that actually have
  // a value for that field (not a fixed /7). kcal counts a day when > 0.
  const weeklyMeans = useMemo(() => {
    const avg = (k: "weight_kg" | "steps"): number | null => {
      const vals = weekRows
        .map((r) => r[k])
        .filter((v): v is number => typeof v === "number");
      if (vals.length === 0) return null;
      return vals.reduce((s, v) => s + v, 0) / vals.length;
    };
    const kcalVals = weekRows
      .map((r) => r.kcal)
      .filter((v) => typeof v === "number" && v > 0);
    const kcalAvg =
      kcalVals.length === 0
        ? null
        : kcalVals.reduce((s, v) => s + v, 0) / kcalVals.length;
    return {
      weight: avg("weight_kg"),
      kcal: kcalAvg,
      steps: avg("steps"),
    };
  }, [weekRows]);

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-1">
        <div
          className="text-base font-extrabold"
          style={{ color: "var(--color-navy)" }}
        >
          Kalendar aktivnosti
        </div>
      </div>
      <div
        className="px-5 pb-2 text-[12px]"
        style={{ color: "var(--color-muted)" }}
      >
        Unesi težinu i korake za svaki dan. Kalorije se računaju iz dnevnika
        prehrane.
      </div>

      <WeekNav
        weekStart={weekStart}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
      />

      {weekLoading ? (
        <InlineLoading text="Pričekajte..." className="px-5" />
      ) : (
        <div className="pt-1">
          {days.map((d) => {
            const iso = formatLocalISO(d);
            const r = byDate.get(iso);
            return (
              <DayMetricsCard
                key={iso}
                date={d}
                iso={iso}
                weightKg={r?.weight_kg ?? null}
                steps={r?.steps ?? null}
                kcal={r?.kcal ?? 0}
                isToday={iso === todayIso}
                saving={savingIso === iso}
                disabled={iso > todayIso}
                onSaveWeight={(v) => saveField(iso, { weight_kg: v })}
                onSaveSteps={(v) => saveField(iso, { steps: v })}
              />
            );
          })}
        </div>
      )}

      <WeeklyMeansBlock
        weight={weeklyMeans.weight}
        kcal={weeklyMeans.kcal}
        steps={weeklyMeans.steps}
      />

      {allLoading ? (
        <InlineLoading text="Pričekajte..." className="px-5" />
      ) : (
        <>
          <div className="px-5 pt-3 pb-2">
            <div
              className="text-[15px] font-extrabold"
              style={{ color: "var(--color-navy)" }}
            >
              Pregled napretka
            </div>
            <div
              className="text-[12px]"
              style={{ color: "var(--color-muted)" }}
            >
              Početna, promjena i trenutna težina od prvog unosa do danas.
            </div>
          </div>

          <MetricChart
            title="Težina (kg)"
            unit="kg"
            color="var(--color-navy)"
            points={chartPoints}
            formatValue={(n) => formatKg(n)}
          />

          <StatsBlock
            first={stats.first}
            current={stats.current}
            delta={stats.delta}
            pct={stats.pct}
          />
        </>
      )}
      <div className="h-6" />
    </>
  );
}

function WeeklyMeansBlock({
  weight,
  kcal,
  steps,
}: {
  weight: number | null;
  kcal: number | null;
  steps: number | null;
}) {
  return (
    <div className="kf-card mx-3 mb-3 bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border">
        <span
          className="text-sm font-bold"
          style={{ color: "var(--color-navy)" }}
        >
          Pregled tjednih sredina
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3">
        <Stat
          label="Težina"
          value={weight != null ? `${formatKg(weight)} kg` : "—"}
        />
        <Stat
          label="Kalorije"
          value={kcal != null ? `${Math.round(kcal)} kcal` : "—"}
          accent
        />
        <Stat
          label="Koraci"
          value={steps != null ? String(Math.round(steps)) : "—"}
        />
      </div>
    </div>
  );
}

function StatsBlock({
  first,
  current,
  delta,
  pct,
}: {
  first: number | null;
  current: number | null;
  delta: number | null;
  pct: number | null;
}) {
  const isLoss = delta != null && delta < 0;
  const isGain = delta != null && delta > 0;
  const changeColor = isLoss
    ? "#1d9b6c"
    : isGain
      ? "#c0392b"
      : "var(--color-muted)";
  const changeLabel =
    delta == null
      ? "—"
      : isLoss
        ? "Izgubljeno"
        : isGain
          ? "Dobiveno"
          : "Bez promjene";

  return (
    <div className="kf-card mx-3 mb-3 bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border">
        <span
          className="text-sm font-bold"
          style={{ color: "var(--color-navy)" }}
        >
          Pregled
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3">
        <Stat
          label="Početna težina"
          value={first != null ? `${formatKg(first)} kg` : "—"}
        />
        <Stat
          label={changeLabel}
          value={renderDelta(delta, pct, changeColor)}
        />
        <Stat
          label="Trenutna težina"
          value={current != null ? `${formatKg(current)} kg` : "—"}
          accent
        />
      </div>
    </div>
  );
}

function DeltaIcon({
  kind,
  color,
}: {
  kind: "down" | "up" | "equal";
  color: string;
}) {
  if (kind === "equal") {
    return (
      <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M5 9h14M5 15h14" />
      </svg>
    );
  }
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "down" ? (
        <>
          <path d="M12 5v14" />
          <path d="M5 12l7 7 7-7" />
        </>
      ) : (
        <>
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </>
      )}
    </svg>
  );
}

function renderDelta(delta: number | null, pct: number | null, color: string) {
  if (delta == null) return <span style={{ color }}>—</span>;
  const abs = Math.abs(delta);
  const kind: "down" | "up" | "equal" =
    delta < 0 ? "down" : delta > 0 ? "up" : "equal";
  return (
    <span style={{ color }}>
      <span className="inline-flex items-center justify-center gap-1">
        <DeltaIcon kind={kind} color={color} />
        <span>{abs === 0 ? "0" : formatKg(abs)} kg</span>
      </span>
      {pct != null && abs !== 0 && (
        <span className="block text-[10px] font-semibold mt-0.5">
          {formatPct(pct)}
        </span>
      )}
    </span>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="bg-bg rounded-xl px-2.5 py-2.5 text-center">
      <div
        className="text-[9.5px] font-bold uppercase tracking-wider mb-1"
        style={{ color: "var(--color-muted)" }}
      >
        {label}
      </div>
      <div
        className="text-[15px] font-extrabold leading-tight"
        style={{
          color: accent ? "var(--color-orange)" : "var(--color-navy)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
