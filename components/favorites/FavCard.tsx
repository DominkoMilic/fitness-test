"use client";
import { MEAL_NAMES } from "@/lib/constants/meals";
import type { FavoriteRow } from "@/types/database";

type Props = {
  fav: FavoriteRow;
  onAdd: () => void;
  onDelete: () => void;
};

export function FavCard({ fav, onAdd, onDelete }: Props) {
  const totalKcal =
    fav.total_kcal ?? fav.items.reduce((s, i) => s + (Number(i.kcal) || 0), 0);
  const totalP =
    fav.total_p ?? fav.items.reduce((s, i) => s + (Number(i.p) || 0), 0);

  return (
    <div className="kf-card bg-white rounded-2xl mb-2.5 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-border">
        <div>
          <div
            className="text-sm font-bold"
            style={{ color: "var(--color-navy)" }}
          >
            {fav.name}
          </div>
          <div
            className="text-[11px] mt-0.5"
            style={{ color: "var(--color-muted)" }}
          >
            {MEAL_NAMES[fav.meal]} · {Math.round(totalKcal)} kcal · P:{" "}
            {Math.round(totalP)}g · {fav.items.length} namirnica
          </div>
        </div>
        <div className="flex gap-1.5 items-center">
          <button
            onClick={onAdd}
            className="bg-orange text-white rounded-lg px-3 py-1.5 text-xs font-bold"
          >
            + Dodaj
          </button>
          <button
            onClick={onDelete}
            aria-label="Obriši"
            className="kf-icon-btn text-gray-300 text-lg w-7 h-7 flex items-center justify-center"
          >
            ×
          </button>
        </div>
      </div>
      {fav.items.map((it, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between px-3.5 py-1.5 border-b border-border last:border-b-0"
        >
          <div className="text-xs font-semibold">{it.name}</div>
          <div className="text-[11px]" style={{ color: "var(--color-muted)" }}>
            {it.pieces ? `${it.pieces} kom` : `${it.grams}g`} ·{" "}
            {Math.round(it.kcal)} kcal
          </div>
        </div>
      ))}
    </div>
  );
}
