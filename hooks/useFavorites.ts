"use client";
import { useCallback, useEffect, useState } from "react";
import { listFavorites, createFavorite, deleteFavorite } from "@/lib/api/favorites";
import type { FavoriteInsert, FavoriteRow } from "@/types/database";

export function useFavorites(code: string | undefined) {
  const [favs, setFavs] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    try {
      setFavs(await listFavorites(code));
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { refresh(); }, [refresh]);

  const add = async (input: FavoriteInsert) => {
    const created = await createFavorite(input);
    setFavs((prev) => [created, ...prev]);
    return created;
  };

  const remove = async (id: number) => {
    setFavs((prev) => prev.filter((f) => f.id !== id));
    await deleteFavorite(id);
  };

  return { favs, loading, refresh, add, remove };
}
