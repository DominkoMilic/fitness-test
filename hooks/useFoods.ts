"use client";
import { useEffect, useState } from "react";
import {
  FOODS_CHANGED_EVENT,
  loadFoods,
  revalidateFoods,
} from "@/lib/api/foods";
import { DEFAULT_FOODS } from "@/lib/constants/defaultFoods";
import type { FoodEntry } from "@/types/app";

export function useFoods() {
  const [foods, setFoods] = useState<FoodEntry[]>(DEFAULT_FOODS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // `silent` is for reloads triggered by a background revalidation: the list
    // is already on screen, so flipping `loading` back on would flash a
    // spinner over data the user is reading.
    const reload = (silent = false) => {
      if (!silent) setLoading(true);
      loadFoods()
        .then((entries) => {
          if (!cancelled) setFoods(entries);
        })
        .finally(() => !cancelled && setLoading(false));
    };

    reload();

    const onFoodsChanged = () => reload(true);

    // An installed PWA is resumed, not reloaded, so a check that only runs on
    // mount can go days without firing. Re-probe when the app returns to the
    // foreground — exactly when an overnight sheet-sync should become visible.
    // Same reasoning as PWARegister's own update check. revalidateFoods()
    // self-throttles, so this is safe to fire on every foreground.
    const onVisible = () => {
      if (document.visibilityState === "visible") revalidateFoods();
    };

    window.addEventListener(FOODS_CHANGED_EVENT, onFoodsChanged);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    return () => {
      cancelled = true;
      window.removeEventListener(FOODS_CHANGED_EVENT, onFoodsChanged);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, []);

  const addLocal = (food: FoodEntry) => setFoods((prev) => [...prev, food]);

  return { foods, loading, addLocal, setFoods };
}
