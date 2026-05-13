"use client";
import { useCallback, useEffect, useState } from "react";
import {
  clearSearchHistory,
  listSearchHistory,
  pushSearchHistory,
  removeSearchHistoryItem,
  type SearchHistoryRow,
} from "@/lib/api/searchHistory";

export type HistoryEntry = {
  foodId: number;
  grams: number;
  pieces: number | null;
};

export function useHistory(userId: string | undefined) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(() => Boolean(userId));

  const reload = useCallback(async () => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await listSearchHistory(userId);
      setEntries(rows.map(rowToEntry));
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
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

  const push = useCallback(
    async (foodId: number, grams: number, pieces: number | null) => {
      if (!userId) return;
      const id = Number(foodId);
      const next: HistoryEntry = { foodId: id, grams, pieces };
      setEntries((prev) =>
        [next, ...prev.filter((e) => e.foodId !== id)].slice(0, 15),
      );
      try {
        await pushSearchHistory(userId, id, grams, pieces);
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
      setEntries((prev) => prev.filter((e) => e.foodId !== id));
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
    setEntries([]);
    try {
      await clearSearchHistory(userId);
    } catch {
      reload();
    }
  }, [userId, reload]);

  return { entries, loading, push, remove, clear, reload };
}

function rowToEntry(r: SearchHistoryRow): HistoryEntry {
  return { foodId: r.food_id, grams: r.grams, pieces: r.pieces };
}
