"use client";
import { useCallback, useEffect, useState } from "react";
import {
  listWeightHistory,
  upsertDailyMetric,
} from "@/lib/api/dailyMetrics";
import type { DailyMetricsApi } from "@/types/database";

export function useWeightHistory(userId: string | undefined) {
  const [rows, setRows] = useState<DailyMetricsApi[]>([]);
  const [loading, setLoading] = useState<boolean>(() => Boolean(userId));

  const refresh = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await listWeightHistory());
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveWeight = async (date: string, weight_kg: number | null) => {
    await upsertDailyMetric({ date, weight_kg });
    await refresh();
  };

  return { rows, loading, refresh, saveWeight };
}
