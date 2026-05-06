"use client";
import { MEAL_KEYS } from "@/lib/constants/meals";
import type { FoodLogRow } from "@/types/database";
import { MealCard } from "./MealCard";

type Props = {
  logs: FoodLogRow[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

export function MealsList({ logs, onEdit, onDelete }: Props) {
  return (
    <div>
      {MEAL_KEYS.map((meal) => (
        <MealCard
          key={meal}
          meal={meal}
          items={logs.filter((l) => l.meal === meal)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
