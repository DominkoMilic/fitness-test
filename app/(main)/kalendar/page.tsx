"use client";
import { useMemo, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useDailyMetrics } from "@/hooks/useDailyMetrics";
import { useUIStore } from "@/store/useUIStore";
import { WeekNav } from "@/components/kalendar/WeekNav";
import { DayMetricsCard } from "@/components/kalendar/DayMetricsCard";
import { MetricChart } from "@/components/kalendar/MetricChart";
import { InlineLoading } from "@/components/ui/Loading";
import {
  WEEKDAY_SHORT_HR,
  addDays,
  formatLocalISO,
  startOfWeekMonday,
  weekDays,
} from "@/lib/utils/week";

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

  const { rows, loading, save } = useDailyMetrics(user?.id, from, to);
  const [savingIso, setSavingIso] = useState<string | null>(null);

  const byDate = new Map(rows.map((r) => [r.date, r]));

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

  // Chart point series. Use first 3 letters of weekday for x-axis labels.
  const chartPoints = (kind: "weight" | "kcal" | "steps") =>
    days.map((d, i) => {
      const iso = formatLocalISO(d);
      const r = byDate.get(iso);
      let value: number | null = null;
      if (r) {
        if (kind === "weight") value = r.weight_kg;
        else if (kind === "kcal") value = r.kcal > 0 ? r.kcal : null;
        else value = r.steps;
      }
      return { label: WEEKDAY_SHORT_HR[i], value };
    });

  const goal = user?.goal ?? null;

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

      {loading ? (
        <InlineLoading text="Pričekajte..." className="px-5" />
      ) : (
        <>
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
                  onSaveWeight={(v) => saveField(iso, { weight_kg: v })}
                  onSaveSteps={(v) => saveField(iso, { steps: v })}
                />
              );
            })}
          </div>

          <div className="pt-3">
            <MetricChart
              title="Težina (kg)"
              unit="kg"
              color="var(--color-navy)"
              points={chartPoints("weight")}
              formatValue={(n) => (Math.round(n * 10) / 10).toFixed(1)}
            />
            <MetricChart
              title="Kalorije (kcal)"
              unit="kcal"
              color="var(--color-orange)"
              points={chartPoints("kcal")}
              reference={
                goal != null ? { value: goal, label: "Cilj" } : undefined
              }
              formatValue={(n) => String(Math.round(n))}
            />
            <MetricChart
              title="Koraci"
              unit=""
              color="#1d9b6c"
              points={chartPoints("steps")}
              formatValue={(n) => String(Math.round(n))}
            />
          </div>
        </>
      )}
      <div className="h-6" />
    </>
  );
}
