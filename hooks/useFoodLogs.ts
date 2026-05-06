"use client";
import { useCallback, useEffect, useState } from "react";
import { listLogs, deleteLog as apiDelete, insertLog, updateLog as apiUpdate, insertLogs } from "@/lib/api/foodLogs";
import type { FoodLogInsert, FoodLogRow } from "@/types/database";

export function useFoodLogs(code: string | undefined, date: string) {
  const [logs, setLogs] = useState<FoodLogRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    try {
      const rows = await listLogs(code, date);
      setLogs(rows);
    } finally {
      setLoading(false);
    }
  }, [code, date]);

  useEffect(() => { refresh(); }, [refresh]);

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
