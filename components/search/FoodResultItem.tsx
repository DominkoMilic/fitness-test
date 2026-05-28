"use client";
import type { FoodEntry } from "@/types/app";
import { describeAmount, getPieceInfo } from "@/lib/utils/macros";

type HistoryHint = { grams: number; pieces: number | null };

type Props = {
  food: FoodEntry;
  onClick: () => void;
  /** When set, show stored amount + orange "+" quick-add (no modal). */
  historyEntry?: HistoryHint;
  onQuickAdd?: () => void;
};

export function FoodResultItem({
  food,
  onClick,
  historyEntry,
  onQuickAdd,
}: Props) {
  const hasPiece = !!getPieceInfo(food);
  const amountLabel = historyEntry
    ? describeAmount(historyEntry.grams, historyEntry.pieces, food)
    : null;

  return (
    <div
      onClick={onClick}
      className="kf-link-row px-5 py-3 bg-white border-b border-border cursor-pointer flex items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1 gap-2">
          <span className="text-sm font-semibold truncate">{food.name}</span>
          <span
            className="text-[13px] font-extrabold whitespace-nowrap"
            style={{ color: "var(--color-navy)" }}
          >
            {food.kcal} kcal
          </span>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <Macro k="P" v={food.p} />
          <Macro k="UH" v={food.u} />
          <Macro k="M" v={food.m} />
          <span className="text-[11px] text-gray-300">na 100g</span>
          {hasPiece && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50"
              style={{ color: "var(--color-navy)" }}
            >
              kom
            </span>
          )}
        </div>
      </div>
      {historyEntry && onQuickAdd && (
        <div className="flex items-center gap-2 shrink-0">
          {amountLabel && (
            <span
              className="text-[11px] font-bold px-2 py-1 rounded-lg bg-orange/10 whitespace-nowrap"
              style={{ color: "var(--color-orange)" }}
            >
              Unesite {amountLabel}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickAdd();
            }}
            aria-label={`Dodaj odmah · ${amountLabel ?? ""}`}
            className="w-7 h-7 rounded-full text-white text-lg flex items-center justify-center"
            style={{ background: "var(--color-orange)" }}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

function Macro({ k, v }: { k: string; v: number }) {
  return (
    <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
      {k}: <span className="font-bold text-gray-700">{v}g</span>
    </span>
  );
}
