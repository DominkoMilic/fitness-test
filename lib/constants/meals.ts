import type { MealKey } from "@/types/database";

export const MEAL_KEYS: MealKey[] = ["dorucak", "rucak", "vecera", "uzina"];

export const MEAL_NAMES: Record<MealKey, string> = {
  dorucak: "Doručak",
  rucak: "Ručak",
  vecera: "Večera",
  uzina: "Užina",
};
