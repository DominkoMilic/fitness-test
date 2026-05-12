// Client wrapper around /api/me/search-history. user_id derived from
// session cookie server-side; passed-in userId is informational only.

export type SearchHistoryRow = {
  user_id: string;
  food_id: number;
  grams: number;
  pieces: number | null;
  last_searched_at: string;
};

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

export async function listSearchHistory(
  _userId: string,
): Promise<SearchHistoryRow[]> {
  const body = await jsonFetch<{ data: SearchHistoryRow[] }>(
    "/api/me/search-history",
  );
  return (body.data ?? []).map((r) => ({
    user_id: String(r.user_id),
    food_id: Number(r.food_id),
    grams: Number(r.grams ?? 100),
    pieces: r.pieces == null ? null : Number(r.pieces),
    last_searched_at: String(r.last_searched_at),
  }));
}

export async function pushSearchHistory(
  _userId: string,
  foodId: number,
  grams: number,
  pieces: number | null,
): Promise<void> {
  await jsonFetch("/api/me/search-history", {
    method: "POST",
    body: JSON.stringify({ foodId, grams, pieces }),
  });
}

export async function removeSearchHistoryItem(
  _userId: string,
  foodId: number,
): Promise<void> {
  await jsonFetch(`/api/me/search-history/${foodId}`, { method: "DELETE" });
}

export async function clearSearchHistory(_userId: string): Promise<void> {
  await jsonFetch("/api/me/search-history", { method: "DELETE" });
}
