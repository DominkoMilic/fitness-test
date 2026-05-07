"use client";
import type { FoodEntry } from "@/types/app";

type Props = {
  items: FoodEntry[];
  onAdd: (id: number) => void;
  onRemove?: (id: number) => void;
  onClear?: () => void;
};

export function HistoryList({ items, onAdd, onRemove, onClear }: Props) {
  if (!items.length) {
    return (
      <div
        className="p-8 text-center text-[13px]"
        style={{ color: "var(--color-muted)" }}
      >
        Počni pretraživati namirnicu gore.
      </div>
    );
  }
  return (
    <div className="px-5 pt-3 pb-2">
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "var(--color-muted)" }}
        >
          Povijest
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="text-[11px] font-semibold uppercase tracking-wider hover:underline"
            style={{ color: "var(--color-muted)" }}
          >
            Obriši sve
          </button>
        )}
      </div>
      {items.map((f) => (
        <div
          key={f.id}
          className="kf-row flex items-center justify-between py-2 px-2 -mx-2 rounded-lg border-b border-border last:border-b-0"
        >
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate">{f.name}</div>
            <div
              className="text-[11px] mt-px"
              style={{ color: "var(--color-muted)" }}
            >
              {f.kcal} kcal · P:{f.p}g U:{f.u}g M:{f.m}g na 100g
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onRemove && (
              <button
                onClick={() => onRemove(Number(f.id))}
                aria-label="Ukloni iz povijesti"
                className="w-7 h-7 rounded-full text-base flex items-center justify-center border border-border hover:text-red-500"
                style={{ color: "var(--color-muted)" }}
              >
                ×
              </button>
            )}
            <button
              onClick={() => onAdd(Number(f.id))}
              className="w-7 h-7 rounded-full text-white text-lg flex items-center justify-center"
              style={{ background: "var(--color-orange)" }}
            >
              +
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
