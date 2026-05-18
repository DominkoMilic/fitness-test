"use client";
import { useCallback, useEffect, useState } from "react";
import {
  listDailyMetrics,
  upsertDailyMetric,
} from "@/lib/api/dailyMetrics";
import type { DailyMetricsApi } from "@/types/database";

export function useDailyMetrics(
  userId: string | undefined,
  from: string,
  to: string,
) {
  const [rows, setRows] = useState<DailyMetricsApi[]>([]);
  const [loading, setLoading] = useState<boolean>(
    () => Boolean(userId && from && to),
  );

  const refresh = useCallback(async () => {
    if (!userId || !from || !to) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await listDailyMetrics(from, to));
    } finally {
      setLoading(false);
    }
  }, [userId, from, to]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async (patch: {
    date: string;
    weight_kg?: number | null;
    steps?: number | null;
  }) => {
    await upsertDailyMetric(patch);
    setRows((prev) =>
      prev.map((r) =>
        r.date === patch.date
          ? {
              ...r,
              weight_kg:
                patch.weight_kg !== undefined ? patch.weight_kg : r.weight_kg,
              steps: patch.steps !== undefined ? patch.steps : r.steps,
            }
          : r,
      ),
    );
  };

  return { rows, loading, refresh, save };
}
