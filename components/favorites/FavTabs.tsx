"use client";
import { MEAL_KEYS, MEAL_NAMES } from "@/lib/constants/meals";
import type { MealFilter } from "@/types/app";

type Props = { value: MealFilter; onChange: (v: MealFilter) => void };

export function FavTabs({ value, onChange }: Props) {
  const opts: { key: MealFilter; label: string }[] = [
    { key: "sve", label: "Svi" },
    ...MEAL_KEYS.map((k) => ({ key: k as MealFilter, label: MEAL_NAMES[k] })),
  ];
  return (
    <div className="flex gap-1.5 px-5 py-3 overflow-x-auto">
      {opts.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border-[1.5px] ${
              active
                ? "border-[var(--color-navy)] bg-[var(--color-navy)] text-white"
                : "border-border bg-white"
            }`}
            style={{ color: active ? "#fff" : "var(--color-muted)" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
