// Client wrapper around /api/me/favorites/* and /api/admin/users/[code]/favorites.
// `userId` parameters are informational; the server derives user identity
// from the httpOnly session cookie.

import type { FavoriteInsert, FavoriteRow } from "@/types/database";

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

export async function listFavorites(_userId: string): Promise<FavoriteRow[]> {
  const body = await jsonFetch<{ data: FavoriteRow[] }>("/api/me/favorites");
  return body.data ?? [];
}

export async function listFavoritesAsAdmin(
  code: string,
): Promise<FavoriteRow[]> {
  const body = await jsonFetch<{ data: FavoriteRow[] }>(
    `/api/admin/users/${encodeURIComponent(code)}/favorites`,
  );
  return body.data ?? [];
}

export async function createFavorite(fav: FavoriteInsert): Promise<FavoriteRow> {
  const body = await jsonFetch<{ data: FavoriteRow }>("/api/me/favorites", {
    method: "POST",
    body: JSON.stringify(fav),
  });
  return body.data;
}

export async function deleteFavorite(id: number): Promise<void> {
  await jsonFetch(`/api/me/favorites/${id}`, { method: "DELETE" });
}

export async function updateFavorite(
  id: number,
  _userId: string | undefined,
  patch: Partial<Omit<FavoriteInsert, "user_id">>,
): Promise<FavoriteRow> {
  const body = await jsonFetch<{ data: FavoriteRow }>(
    `/api/me/favorites/${id}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return body.data;
}
