"use client";
import type { RecipeGroup } from "@/lib/utils/groupLogs";
import { portionsLabel } from "@/lib/utils/groupLogs";

type Props = {
  group: RecipeGroup;
  onClick?: () => void;
  onDelete?: () => void;
};

// Collapsed recipe row on the dashboard: one "1 sarma" card summing the whole
// added portion. Tapping it opens the drill-in modal with each food.
export function RecipeLogCard({ group, onClick, onDelete }: Props) {
  const { name, portions, items, totals } = group;
  const sub = [
    portionsLabel(portions),
    `${items.length} ${items.length === 1 ? "namirnica" : "namirnice"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      onClick={onClick}
      className={`kf-row px-3.5 py-2.5 border-b border-border last:border-b-0 ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
              style={{
                color: "var(--color-orange)",
                background: "rgba(255,138,0,0.1)",
              }}
            >
              Recept
            </span>
            <span className="text-[13px] font-semibold truncate">{name}</span>
          </div>
          <div
            className="text-[11px] mt-px"
            style={{ color: "var(--color-muted)" }}
          >
            {sub}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[13px] font-bold whitespace-nowrap"
            style={{ color: "var(--color-navy)" }}
          >
            {Math.round(totals.kcal)} kcal
          </span>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="kf-icon-btn text-gray-300 text-lg w-7 h-7 flex items-center justify-center"
              aria-label="Obriši"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <div className="flex gap-2.5 mt-1">
        <Tag k="P" v={totals.p} />
        <Tag k="UH" v={totals.u} />
        <Tag k="M" v={totals.m} />
      </div>
    </div>
  );
}

function Tag({ k, v }: { k: string; v: number }) {
  return (
    <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
      {k}: <span className="font-bold text-gray-700">{Math.round(v)}g</span>
    </span>
  );
}
