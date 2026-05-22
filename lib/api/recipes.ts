// Client wrapper around /api/me/recipes/* and /api/admin/users/[code]/recipes.
// `userId` parameters are informational; server derives user identity from
// the httpOnly session cookie.

import type { RecipeInsert, RecipeRow } from "@/types/database";

async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function listRecipes(_userId: string): Promise<RecipeRow[]> {
  const body = await jsonFetch<{ data: RecipeRow[] }>("/api/me/recipes");
  return body.data ?? [];
}

export async function listRecipesAsAdmin(code: string): Promise<RecipeRow[]> {
  const body = await jsonFetch<{ data: RecipeRow[] }>(
    `/api/admin/users/${encodeURIComponent(code)}/recipes`,
  );
  return body.data ?? [];
}

export async function createRecipe(rec: RecipeInsert): Promise<RecipeRow> {
  const body = await jsonFetch<{ data: RecipeRow }>("/api/me/recipes", {
    method: "POST",
    body: JSON.stringify(rec),
  });
  return body.data;
}

export async function deleteRecipe(id: number): Promise<void> {
  await jsonFetch(`/api/me/recipes/${id}`, { method: "DELETE" });
}

export async function updateRecipe(
  id: number,
  _userId: string | undefined,
  patch: Partial<Omit<RecipeInsert, "user_id">>,
): Promise<RecipeRow> {
  const body = await jsonFetch<{ data: RecipeRow }>(
    `/api/me/recipes/${id}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return body.data;
}
