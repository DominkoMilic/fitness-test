"use client";
import { MEAL_KEYS } from "@/lib/constants/meals";
import type { FoodLogRow } from "@/types/database";
import type { RecipeGroup } from "@/lib/utils/groupLogs";
import { MealCard } from "./MealCard";

type Props = {
  logs: FoodLogRow[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onOpenGroup?: (group: RecipeGroup) => void;
  onDeleteGroup?: (group: RecipeGroup) => void;
  readOnly?: boolean;
};

export function MealsList({
  logs,
  onEdit,
  onDelete,
  onOpenGroup,
  onDeleteGroup,
  readOnly = false,
}: Props) {
  return (
    <div className="pt-2">
      {MEAL_KEYS.map((meal, idx) => (
        <MealCard
          key={meal}
          meal={meal}
          items={logs.filter((l) => l.meal === meal)}
          onEdit={onEdit}
          onDelete={onDelete}
          onOpenGroup={onOpenGroup}
          onDeleteGroup={onDeleteGroup}
          className={idx === 0 ? "mb-4" : ""}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
