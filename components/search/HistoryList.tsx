"use client";
import { describeAmount } from "@/lib/utils/macros";
import type { FoodEntry } from "@/types/app";

export type HistoryListItem = {
  food: FoodEntry;
  grams: number;
  pieces: number | null;
};

type Props = {
  items: HistoryListItem[];
  onQuickAdd: (foodId: number) => void;
  onEdit: (foodId: number) => void;
  onRemove?: (foodId: number) => void;
  onClear?: () => void;
};

export function HistoryList({
  items,
  onQuickAdd,
  onEdit,
  onRemove,
  onClear,
}: Props) {
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
      {items.map(({ food, grams, pieces }) => {
        const id = Number(food.id);
        const amountLabel = describeAmount(grams, pieces, food);
        return (
          <div
            key={id}
            className="kf-row flex items-center justify-between py-2 px-2 -mx-2 rounded-lg border-b border-border last:border-b-0"
          >
            <button
              onClick={() => onEdit(id)}
              className="flex-1 min-w-0 text-left"
            >
              <div className="text-[13px] font-semibold truncate">
                {food.name}
              </div>
              <div
                className="text-[11px] mt-px"
                style={{ color: "var(--color-muted)" }}
              >
                {amountLabel} · {food.kcal} kcal/100g
              </div>
            </button>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {onRemove && (
                <button
                  onClick={() => onRemove(id)}
                  aria-label="Ukloni iz povijesti"
                  className="w-7 h-7 rounded-full text-base flex items-center justify-center border border-border hover:text-red-500"
                  style={{ color: "var(--color-muted)" }}
                >
                  ×
                </button>
              )}
              <button
                onClick={() => onQuickAdd(id)}
                aria-label="Dodaj odmah"
                className="w-7 h-7 rounded-full text-white text-lg flex items-center justify-center"
                style={{ background: "var(--color-orange)" }}
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
