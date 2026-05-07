"use client";
import { useEffect, useState } from "react";
import { FOODS_CHANGED_EVENT, loadFoods } from "@/lib/api/foods";
import { DEFAULT_FOODS } from "@/lib/constants/defaultFoods";
import type { FoodEntry } from "@/types/app";

export function useFoods() {
  const [foods, setFoods] = useState<FoodEntry[]>(DEFAULT_FOODS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const reload = () => {
      setLoading(true);
      loadFoods()
        .then((entries) => {
          if (!cancelled) setFoods(entries);
        })
        .finally(() => !cancelled && setLoading(false));
    };

    reload();

    const onFoodsChanged = () => reload();
    window.addEventListener(FOODS_CHANGED_EVENT, onFoodsChanged);

    return () => {
      cancelled = true;
      window.removeEventListener(FOODS_CHANGED_EVENT, onFoodsChanged);
    };
  }, []);

  const addLocal = (food: FoodEntry) => setFoods((prev) => [...prev, food]);

  return { foods, loading, addLocal, setFoods };
}
