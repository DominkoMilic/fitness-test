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
      className="kf-link-row px-5 py-3.5 bg-white border-b border-border cursor-pointer flex items-stretch gap-3"
    >
      {/* Left column: name + macros */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="text-sm font-semibold truncate">{food.name}</div>
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

      {/* Right column: kcal on top, history badge below (when present) */}
      <div className="shrink-0 flex flex-col items-end justify-center gap-1">
        <span
          className="text-[13px] font-extrabold whitespace-nowrap leading-none"
          style={{ color: "var(--color-navy)" }}
        >
          {food.kcal} kcal
        </span>
        {amountLabel && (
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-orange/10 whitespace-nowrap leading-tight"
            style={{ color: "var(--color-orange)" }}
          >
            Zadnji unos: {amountLabel}
          </span>
        )}
      </div>

      {/* Quick-add button — only when history hint present */}
      {historyEntry && onQuickAdd && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onQuickAdd();
          }}
          aria-label={`Dodaj odmah · ${amountLabel ?? ""}`}
          className="shrink-0 self-center w-8 h-8 rounded-full text-white text-lg flex items-center justify-center"
          style={{ background: "var(--color-orange)" }}
        >
          +
        </button>
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
