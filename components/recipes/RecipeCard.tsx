"use client";
import { MEAL_NAMES } from "@/lib/constants/meals";
import type { RecipeRow } from "@/types/database";

type Props = {
  recipe: RecipeRow;
  onAdd?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function RecipeCard({ recipe, onAdd, onEdit, onDelete }: Props) {
  const people = Math.max(1, Number(recipe.people) || 1);
  const totalKcal =
    recipe.total_kcal ??
    recipe.items.reduce((s, i) => s + (Number(i.kcal) || 0), 0);
  const totalP =
    recipe.total_p ?? recipe.items.reduce((s, i) => s + (Number(i.p) || 0), 0);
  const perKcal = totalKcal / people;
  const perP = totalP / people;

  return (
    <div className="kf-card bg-white rounded-2xl mb-2.5 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-border">
        <div className="min-w-0">
          <div
            className="text-sm font-bold truncate"
            style={{ color: "var(--color-navy)" }}
          >
            {recipe.name}
          </div>
          <div
            className="text-[11px] mt-0.5"
            style={{ color: "var(--color-muted)" }}
          >
            {MEAL_NAMES[recipe.meal]} · {Math.round(totalKcal)} kcal · {people}{" "}
            {people === 1 ? "porcija" : people < 5 ? "porcije" : "porcija"} ·{" "}
            {recipe.items.length} namirnica
          </div>
          <div
            className="text-[11px] mt-0.5 font-semibold"
            style={{ color: "var(--color-orange)" }}
          >
            Po porciji: {Math.round(perKcal)} kcal · P: {Math.round(perP)}g
          </div>
        </div>
        {(onAdd || onEdit || onDelete) && (
          <div className="flex gap-1.5 items-center shrink-0">
            {onEdit && (
              <button
                onClick={onEdit}
                className="rounded-lg px-3 py-1.5 text-xs font-bold border border-border"
                style={{ color: "var(--color-navy)" }}
              >
                Uredi
              </button>
            )}
            {onAdd && (
              <button
                onClick={onAdd}
                className="bg-orange text-white rounded-lg px-3 py-1.5 text-xs font-bold"
              >
                + Dodaj
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                aria-label="Obriši"
                className="kf-icon-btn text-gray-300 text-lg w-7 h-7 flex items-center justify-center"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>
      {recipe.items.map((it, idx) => (
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
