"use client";
import { useEffect, useState } from "react";
import { listLogsAsAdmin } from "@/lib/api/foodLogs";
import { listFavoritesAsAdmin } from "@/lib/api/favorites";
import { listRecipesAsAdmin } from "@/lib/api/recipes";
import {
  listDailyMetricsAsAdmin,
  listWeightHistoryAsAdmin,
} from "@/lib/api/dailyMetrics";
import type {
  DailyMetricsApi,
  FavoriteRow,
  FoodLogRow,
  RecipeRow,
} from "@/types/database";

/** Read-only admin proxy for a user's food logs by date. */
export function useAdminUserFoodLogs(code: string, date: string) {
  const [logs, setLogs] = useState<FoodLogRow[]>([]);
  const [loading, setLoading] = useState<boolean>(() => Boolean(code && date));

  useEffect(() => {
    if (!code || !date) {
      setLogs([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listLogsAsAdmin(code, date)
      .then((rows) => {
        if (!cancelled) setLogs(rows);
      })
      .catch(() => {
        if (!cancelled) setLogs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code, date]);

  return { logs, loading };
}

/** Read-only admin proxy for a user's favorites. */
export function useAdminUserFavorites(code: string) {
  const [favs, setFavs] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState<boolean>(() => Boolean(code));

  useEffect(() => {
    if (!code) {
      setFavs([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listFavoritesAsAdmin(code)
      .then((rows) => {
        if (!cancelled) setFavs(rows);
      })
      .catch(() => {
        if (!cancelled) setFavs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return { favs, loading };
}

/** Read-only admin proxy for a user's recipes. */
export function useAdminUserRecipes(code: string) {
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState<boolean>(() => Boolean(code));

  useEffect(() => {
    if (!code) {
      setRecipes([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listRecipesAsAdmin(code)
      .then((rows) => {
        if (!cancelled) setRecipes(rows);
      })
      .catch(() => {
        if (!cancelled) setRecipes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return { recipes, loading };
}

/** Read-only admin proxy for a user's weekly daily_metrics rows + kcal sums. */
export function useAdminUserDailyMetrics(
  code: string,
  from: string,
  to: string,
) {
  const [rows, setRows] = useState<DailyMetricsApi[]>([]);
  const [loading, setLoading] = useState<boolean>(
    () => Boolean(code && from && to),
  );

  useEffect(() => {
    if (!code || !from || !to) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listDailyMetricsAsAdmin(code, from, to)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code, from, to]);

  return { rows, loading };
}

/** Read-only admin proxy for a user's all-time weight history. */
export function useAdminUserWeightHistory(code: string) {
  const [rows, setRows] = useState<DailyMetricsApi[]>([]);
  const [loading, setLoading] = useState<boolean>(() => Boolean(code));

  useEffect(() => {
    if (!code) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listWeightHistoryAsAdmin(code)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return { rows, loading };
}
