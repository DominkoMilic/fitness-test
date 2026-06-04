"use client";
import { useRouter } from "next/navigation";
import { MEAL_NAMES } from "@/lib/constants/meals";
import type { FoodLogRow, MealKey } from "@/types/database";
import { FoodLogItem } from "./FoodLogItem";
import { RecipeLogCard } from "./RecipeLogCard";
import { groupMealLogs, type RecipeGroup } from "@/lib/utils/groupLogs";
import { useUIStore } from "@/store/useUIStore";

type Props = {
  meal: MealKey;
  items: FoodLogRow[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onOpenGroup?: (group: RecipeGroup) => void;
  onDeleteGroup?: (group: RecipeGroup) => void;
  className?: string;
  readOnly?: boolean;
};

export function MealCard({
  meal,
  items,
  onEdit,
  onDelete,
  onOpenGroup,
  onDeleteGroup,
  className = "",
  readOnly = false,
}: Props) {
  const router = useRouter();
  const openModal = useUIStore((s) => s.openModal);
  const totalKcal = items.reduce((s, i) => s + Number(i.kcal), 0);
  const units = groupMealLogs(items);

  return (
    <div
      className={`kf-card mx-3 mb-3 bg-white rounded-2xl shadow-sm overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-border">
        <span
          className="text-sm font-bold"
          style={{ color: "var(--color-navy)" }}
        >
          {MEAL_NAMES[meal]}
        </span>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full bg-bg"
          style={{ color: "var(--color-muted)" }}
        >
          {Math.round(totalKcal)} kcal
        </span>
      </div>
      {units.map((unit) =>
        unit.kind === "group" ? (
          <RecipeLogCard
            key={unit.groupId}
            group={unit}
            onClick={onOpenGroup ? () => onOpenGroup(unit) : undefined}
            onDelete={onDeleteGroup ? () => onDeleteGroup(unit) : undefined}
          />
        ) : (
          <FoodLogItem
            key={unit.item.id}
            item={unit.item}
            onClick={onEdit ? () => onEdit(unit.item.id) : undefined}
            onDelete={onDelete ? () => onDelete(unit.item.id) : undefined}
          />
        ),
      )}
      {!readOnly && (
        <button
          onClick={() => router.push(`/search?meal=${meal}`)}
          className="flex items-center gap-2 px-3.5 py-2.5 w-full text-[13px] font-semibold"
          style={{ color: "var(--color-orange)" }}
        >
          <svg
            width={15}
            height={15}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Dodaj namirnicu
        </button>
      )}
      {readOnly && items.length === 0 && (
        <div
          className="px-3.5 py-3 text-[12px]"
          style={{ color: "var(--color-muted)" }}
        >
          Nema unosa za ovaj obrok.
        </div>
      )}
      {!readOnly && items.length > 0 && (
        <button
          onClick={() => openModal("saveFav", { meal, items })}
          className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-t border-border"
          style={{
            background: "rgba(27,50,85,0.04)",
            color: "var(--color-navy)",
          }}
        >
          <svg
            width={13}
            height={13}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          Spremi kao omiljeni
        </button>
      )}
    </div>
  );
}
