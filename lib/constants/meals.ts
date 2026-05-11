import type { MealKey } from "@/types/database";
import type { DropdownOption } from "@/components/ui/Dropdown";

export const MEAL_KEYS: MealKey[] = ["dorucak", "rucak", "vecera", "uzina"];

export const MEAL_NAMES: Record<MealKey, string> = {
  dorucak: "Doručak",
  rucak: "Ručak",
  vecera: "Večera",
  uzina: "Užina",
};

export const MEAL_OPTIONS: readonly DropdownOption<MealKey>[] = MEAL_KEYS.map(
  (k) => ({ value: k, label: MEAL_NAMES[k] }),
);
