"use client";
import type { FoodEntry } from "@/types/app";

type Props = { items: FoodEntry[]; onAdd: (id: number) => void };

export function HistoryList({ items, onAdd }: Props) {
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
      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-2"
        style={{ color: "var(--color-muted)" }}
      >
        Povijest
      </div>
      {items.map((f) => (
        <div
          key={f.id}
          className="kf-row flex items-center justify-between py-2 px-2 -mx-2 rounded-lg border-b border-border last:border-b-0"
        >
          <div>
            <div className="text-[13px] font-semibold">{f.name}</div>
            <div
              className="text-[11px] mt-px"
              style={{ color: "var(--color-muted)" }}
            >
              {f.kcal} kcal · P:{f.p}g U:{f.u}g M:{f.m}g na 100g
            </div>
          </div>
          <button
            onClick={() => onAdd(Number(f.id))}
            className="w-7 h-7 rounded-full text-white text-lg flex items-center justify-center"
            style={{ background: "var(--color-orange)" }}
          >
            +
          </button>
        </div>
      ))}
    </div>
  );
}
