"use client";
import type { FoodLogRow } from "@/types/database";

type Props = {
  item: FoodLogRow;
  onClick?: () => void;
  onDelete?: () => void;
};

export function FoodLogItem({ item, onClick, onDelete }: Props) {
  const qty = item.pieces
    ? `${item.pieces} kom (${Math.round(item.grams)}g)`
    : `${item.grams}g`;
  return (
    <div
      onClick={onClick}
      className={`kf-row px-3.5 py-2.5 border-b border-border last:border-b-0 ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[13px] font-semibold">{item.food_name}</div>
          <div
            className="text-[11px] mt-px"
            style={{ color: "var(--color-muted)" }}
          >
            {qty}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[13px] font-bold whitespace-nowrap"
            style={{ color: "var(--color-navy)" }}
          >
            {Math.round(item.kcal)} kcal
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
        <Tag k="P" v={item.p} />
        <Tag k="UH" v={item.u} />
        <Tag k="M" v={item.m} />
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
