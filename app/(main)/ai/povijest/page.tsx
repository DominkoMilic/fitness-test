"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listAnalyses } from "@/lib/api/aiMeals";
import { MEAL_NAMES } from "@/lib/constants/meals";
import { InlineLoading } from "@/components/ui/Loading";
import type { AiMealAnalysisRow } from "@/types/database";

const CONF_LABEL: Record<string, string> = {
  low: "Niska sigurnost",
  medium: "Srednja sigurnost",
  high: "Visoka sigurnost",
};

export default function AiHistoryPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AiMealAnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listAnalyses()
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="px-5 py-5 max-w-2xl mx-auto">
      <button
        onClick={() => router.push("/postavke")}
        className="inline-flex items-center gap-1.5 -ml-1.5 mb-3 px-2.5 py-1.5 rounded-full text-sm font-bold hover:bg-black/5"
        style={{ color: "var(--color-navy)" }}
      >
        <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Natrag
      </button>

      <div className="text-xl font-extrabold mb-1" style={{ color: "var(--color-navy)" }}>
        AI analize
      </div>
      <div className="text-[13px] mb-5" style={{ color: "var(--color-muted)" }}>
        Spremljene AI procjene obroka. Vrijednosti su približne — služe kao
        pomoć pri unosu.
      </div>

      {loading ? (
        <InlineLoading text="Pričekajte..." />
      ) : error ? (
        <div className="text-sm" style={{ color: "var(--color-orange)" }}>
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm" style={{ color: "var(--color-muted)" }}>
          Još nema spremljenih AI analiza.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <div key={r.id} className="kf-card bg-white rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold truncate" style={{ color: "var(--color-navy)" }}>
                    {r.title}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--color-muted)" }}>
                    {r.date}
                    {r.meal ? ` · ${MEAL_NAMES[r.meal]}` : ""} ·{" "}
                    {CONF_LABEL[r.confidence] ?? r.confidence}
                  </div>
                </div>
                <span className="text-[15px] font-extrabold whitespace-nowrap" style={{ color: "var(--color-navy)" }}>
                  {Math.round(Number(r.total_kcal))} kcal
                </span>
              </div>

              {r.kcal_min != null && r.kcal_max != null && (
                <div className="text-[11px] mt-1" style={{ color: "var(--color-muted)" }}>
                  AI raspon: ~{r.kcal_min}–{r.kcal_max} kcal
                </div>
              )}

              <div className="flex gap-3 mt-2 text-[11px]" style={{ color: "var(--color-muted)" }}>
                <span>P: <b className="text-gray-700">{Math.round(Number(r.total_p))}g</b></span>
                <span>UH: <b className="text-gray-700">{Math.round(Number(r.total_u))}g</b></span>
                <span>M: <b className="text-gray-700">{Math.round(Number(r.total_m))}g</b></span>
              </div>

              {Array.isArray(r.items) && r.items.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border flex flex-col gap-1">
                  {r.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-[12px]">
                      <span className="truncate" style={{ color: "var(--color-navy)" }}>
                        {it.name} · {Math.round(it.grams)}g
                      </span>
                      <span className="whitespace-nowrap" style={{ color: "var(--color-muted)" }}>
                        {Math.round(it.kcal)} kcal
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
