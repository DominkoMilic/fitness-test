// Client wrapper around /api/me/logs/* and /api/admin/users/[code]/logs.
// All user-side mutations derive user_id from the httpOnly session cookie
// server-side; the legacy `userId` parameters on these fns are now
// informational (we keep them in signatures to avoid touching call sites).

import type { FoodLogInsert, FoodLogRow } from "@/types/database";

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

export async function listLogs(
  _userId: string,
  date: string,
): Promise<FoodLogRow[]> {
  const body = await jsonFetch<{ data: FoodLogRow[] }>(
    `/api/me/logs?date=${encodeURIComponent(date)}`,
  );
  return body.data ?? [];
}

export async function listLogsAsAdmin(
  code: string,
  date: string,
): Promise<FoodLogRow[]> {
  const body = await jsonFetch<{ data: FoodLogRow[] }>(
    `/api/admin/users/${encodeURIComponent(code)}/logs?date=${encodeURIComponent(date)}`,
  );
  return body.data ?? [];
}

export async function getLog(_id: string): Promise<FoodLogRow | null> {
  // No current consumer needs single-row fetch via API; keep stub for
  // backwards compatibility.
  return null;
}

export async function insertLog(entry: FoodLogInsert): Promise<FoodLogRow> {
  const body = await jsonFetch<{ data: FoodLogRow }>("/api/me/logs", {
    method: "POST",
    body: JSON.stringify(entry),
  });
  return body.data;
}

export async function insertLogs(
  entries: FoodLogInsert[],
): Promise<FoodLogRow[]> {
  if (!entries.length) return [];
  const body = await jsonFetch<{ data: FoodLogRow[] }>("/api/me/logs/bulk", {
    method: "POST",
    body: JSON.stringify({ entries }),
  });
  return body.data ?? [];
}

export async function updateLog(
  id: string,
  patch: Partial<FoodLogInsert>,
): Promise<FoodLogRow> {
  const body = await jsonFetch<{ data: FoodLogRow }>(
    `/api/me/logs/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return body.data;
}

export async function deleteLog(id: string): Promise<void> {
  await jsonFetch(`/api/me/logs/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
