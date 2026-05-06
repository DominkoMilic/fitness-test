"use client";
import { useEffect, useState } from "react";
import { loadFoods } from "@/lib/api/foods";
import { DEFAULT_FOODS } from "@/lib/constants/defaultFoods";
import type { FoodEntry } from "@/types/app";

export function useFoods() {
  const [foods, setFoods] = useState<FoodEntry[]>(DEFAULT_FOODS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadFoods()
      .then((entries) => {
        if (!cancelled) setFoods(entries);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const addLocal = (food: FoodEntry) =>
    setFoods((prev) => [...prev, food]);

  return { foods, loading, addLocal, setFoods };
}
