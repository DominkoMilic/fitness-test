"use client";
import { useCallback, useEffect, useState } from "react";
import {
  clearSearchHistory,
  listSearchHistory,
  pushSearchHistory,
  removeSearchHistoryItem,
} from "@/lib/api/searchHistory";

export function useHistory(userId: string | undefined) {
  const [historyIds, setHistoryIds] = useState<number[]>([]);

  const reload = useCallback(async () => {
    if (!userId) {
      setHistoryIds([]);
      return;
    }
    try {
      const rows = await listSearchHistory(userId);
      setHistoryIds(rows.map((r) => Number(r.food_id)));
    } catch {
      setHistoryIds([]);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // One-time cleanup of pre-DB localStorage history keys.
  useEffect(() => {
    if (typeof window === "undefined") return;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("kf_history_")) localStorage.removeItem(k);
    }
  }, []);

  const add = useCallback(
    async (foodId: number) => {
      if (!userId) return;
      const id = Number(foodId);
      setHistoryIds((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 15));
      try {
        await pushSearchHistory(userId, id);
      } catch {
        reload();
      }
    },
    [userId, reload],
  );

  const remove = useCallback(
    async (foodId: number) => {
      if (!userId) return;
      const id = Number(foodId);
      setHistoryIds((prev) => prev.filter((x) => x !== id));
      try {
        await removeSearchHistoryItem(userId, id);
      } catch {
        reload();
      }
    },
    [userId, reload],
  );

  const clear = useCallback(async () => {
    if (!userId) return;
    setHistoryIds([]);
    try {
      await clearSearchHistory(userId);
    } catch {
      reload();
    }
  }, [userId, reload]);

  return { historyIds, add, remove, clear, reload };
}
