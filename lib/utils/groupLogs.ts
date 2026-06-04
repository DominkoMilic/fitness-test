import type { FoodLogRow } from "@/types/database";
import { sumLogs } from "./macros";

// A meal's rows render as an ordered mix of plain single foods and collapsed
// recipe groups. Rows added together from one recipe-portion share group_id;
// we collapse those into one unit while preserving the original row order
// (anchored at the group's first row).

export type RecipeGroup = {
  kind: "group";
  groupId: string;
  name: string;
  portions: number | null;
  items: FoodLogRow[];
  totals: ReturnType<typeof sumLogs>;
};

export type RenderUnit = { kind: "single"; item: FoodLogRow } | RecipeGroup;

export function groupMealLogs(items: FoodLogRow[]): RenderUnit[] {
  const units: RenderUnit[] = [];
  const groupIndex = new Map<string, number>();

  for (const item of items) {
    if (!item.group_id) {
      units.push({ kind: "single", item });
      continue;
    }
    const existing = groupIndex.get(item.group_id);
    if (existing == null) {
      groupIndex.set(item.group_id, units.length);
      units.push({
        kind: "group",
        groupId: item.group_id,
        name: item.group_name || "Recept",
        portions:
          item.group_portions == null ? null : Number(item.group_portions),
        items: [item],
        totals: sumLogs([item]),
      });
    } else {
      const unit = units[existing] as RecipeGroup;
      unit.items.push(item);
      unit.totals = sumLogs(unit.items);
    }
  }

  return units;
}

// "1 porcija" / "2 porcije" / "5 porcija" — Croatian count of recipe portions.
export function portionsLabel(portions: number | null): string {
  if (portions == null) return "";
  const num = Number.isInteger(portions)
    ? String(portions)
    : String(Math.round(portions * 10) / 10);
  const isOne = Math.abs(portions) === 1;
  const isPaucal =
    Number.isInteger(portions) && portions % 10 >= 2 && portions % 10 <= 4;
  const noun = isOne ? "porcija" : isPaucal ? "porcije" : "porcija";
  return `${num} ${noun}`;
}
