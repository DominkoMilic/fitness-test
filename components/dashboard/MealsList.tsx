"use client";
import { MEAL_KEYS } from "@/lib/constants/meals";
import type { FoodLogRow } from "@/types/database";
import { MealCard } from "./MealCard";

type Props = {
  logs: FoodLogRow[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  readOnly?: boolean;
};

export function MealsList({ logs, onEdit, onDelete, readOnly = false }: Props) {
  return (
    <div className="pt-2">
      {MEAL_KEYS.map((meal, idx) => (
        <MealCard
          key={meal}
          meal={meal}
          items={logs.filter((l) => l.meal === meal)}
          onEdit={onEdit}
          onDelete={onDelete}
          className={idx === 0 ? "mb-4" : ""}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
