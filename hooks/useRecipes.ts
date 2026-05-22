"use client";
import { useCallback, useEffect, useState } from "react";
import {
  listRecipes,
  createRecipe,
  deleteRecipe,
  updateRecipe,
} from "@/lib/api/recipes";
import type { RecipeInsert, RecipeRow } from "@/types/database";

export function useRecipes(userId: string | undefined) {
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState<boolean>(() => Boolean(userId));

  const refresh = useCallback(async () => {
    if (!userId) {
      setRecipes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRecipes(await listRecipes(userId));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = async (input: RecipeInsert) => {
    const created = await createRecipe(input);
    setRecipes((prev) => [created, ...prev]);
    return created;
  };

  const remove = async (id: number) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    await deleteRecipe(id);
  };

  const update = async (
    id: number,
    patch: Parameters<typeof updateRecipe>[2],
  ) => {
    await updateRecipe(id, userId, patch);
    await refresh();
  };

  return { recipes, loading, refresh, add, remove, update };
}
