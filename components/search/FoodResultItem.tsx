"use client";
import type { FoodEntry } from "@/types/app";
import { getPieceInfo } from "@/lib/utils/macros";

type Props = { food: FoodEntry; onClick: () => void };

export function FoodResultItem({ food, onClick }: Props) {
  const hasPiece = !!getPieceInfo(food);
  return (
    <div
      onClick={onClick}
      className="kf-link-row px-5 py-3 bg-white border-b border-border cursor-pointer"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold">{food.name}</span>
        <span
          className="text-[13px] font-extrabold whitespace-nowrap ml-2"
          style={{ color: "var(--color-navy)" }}
        >
          {food.kcal} kcal
        </span>
      </div>
      <div className="flex gap-3 items-center">
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
  );
}

function Macro({ k, v }: { k: string; v: number }) {
  return (
    <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
      {k}: <span className="font-bold text-gray-700">{v}g</span>
    </span>
  );
}
