"use client";
import { useCallback, useEffect, useState } from "react";
import {
  listFavorites,
  createFavorite,
  deleteFavorite,
  updateFavorite,
} from "@/lib/api/favorites";
import type { FavoriteInsert, FavoriteRow } from "@/types/database";

export function useFavorites(userId: string | undefined) {
  const [favs, setFavs] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState<boolean>(() => Boolean(userId));

  const refresh = useCallback(async () => {
    if (!userId) {
      setFavs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setFavs(await listFavorites(userId));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = async (input: FavoriteInsert) => {
    const created = await createFavorite(input);
    setFavs((prev) => [created, ...prev]);
    return created;
  };

  const remove = async (id: number) => {
    setFavs((prev) => prev.filter((f) => f.id !== id));
    await deleteFavorite(id);
  };

  const update = async (
    id: number,
    patch: Parameters<typeof updateFavorite>[2],
  ) => {
    await updateFavorite(id, userId, patch);
    await refresh();
  };

  return { favs, loading, refresh, add, remove, update };
}
