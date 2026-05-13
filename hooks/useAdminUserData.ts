"use client";
import { useEffect, useState } from "react";
import { listLogsAsAdmin } from "@/lib/api/foodLogs";
import { listFavoritesAsAdmin } from "@/lib/api/favorites";
import type { FavoriteRow, FoodLogRow } from "@/types/database";

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
