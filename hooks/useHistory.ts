"use client";
import { useCallback, useEffect, useState } from "react";
import type { FoodEntry } from "@/types/app";

const MAX = 20;
const key = (code: string | undefined) => `kf_history_${code || "guest"}`;

export function useHistory(code: string | undefined) {
  const [history, setHistory] = useState<FoodEntry[]>([]);

  const load = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(key(code));
      setHistory(raw ? JSON.parse(raw) : []);
    } catch {
      setHistory([]);
    }
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const add = (food: FoodEntry) => {
    const next = [
      { id: food.id, name: food.name, kcal: food.kcal, p: food.p, u: food.u, m: food.m },
      ...history.filter((h) => h.id !== food.id),
    ].slice(0, MAX);
    setHistory(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(key(code), JSON.stringify(next));
    }
  };

  return { history, add, reload: load };
}
