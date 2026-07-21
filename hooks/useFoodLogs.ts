"use client";
import { useCallback, useEffect, useState } from "react";
import {
  listLogs,
  deleteLog as apiDelete,
  insertLog,
  updateLog as apiUpdate,
  insertLogs,
  LOGS_CHANGED_EVENT,
} from "@/lib/api/foodLogs";
import type { FoodLogInsert, FoodLogRow } from "@/types/database";

export function useFoodLogs(userId: string | undefined, date: string) {
  const [logs, setLogs] = useState<FoodLogRow[]>([]);
  const [loading, setLoading] = useState<boolean>(() => Boolean(userId));

  const refresh = useCallback(async () => {
    if (!userId) {
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await listLogs(userId, date);
      setLogs(rows);
    } finally {
      setLoading(false);
    }
  }, [userId, date]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-fetch when the diary is mutated elsewhere (e.g. the AI modal in the
  // (main) layout inserts logs outside this hook's own add/remove).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onChanged = () => refresh();
    window.addEventListener(LOGS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(LOGS_CHANGED_EVENT, onChanged);
  }, [refresh]);

  const add = async (entry: FoodLogInsert) => {
    const created = await insertLog(entry);
    setLogs((prev) => [...prev, created]);
    return created;
  };

  const addBulk = async (entries: FoodLogInsert[]) => {
    const created = await insertLogs(entries);
    setLogs((prev) => [...prev, ...created]);
    return created;
  };

  const remove = async (id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    await apiDelete(id);
  };

  const update = async (id: string, patch: Partial<FoodLogInsert>) => {
    const updated = await apiUpdate(id, patch);
    setLogs((prev) => prev.map((l) => (l.id === id ? updated : l)));
    return updated;
  };

  return { logs, loading, refresh, add, addBulk, remove, update };
}
