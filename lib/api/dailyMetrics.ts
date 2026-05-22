import type { DailyMetricsApi } from "@/types/database";

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

export async function listDailyMetrics(
  from: string,
  to: string,
): Promise<DailyMetricsApi[]> {
  const body = await jsonFetch<{ data: DailyMetricsApi[] }>(
    `/api/me/daily-metrics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  return body.data ?? [];
}

// All-time sparse weight history (rows where weight_kg is set, ordered asc).
export async function listWeightHistory(): Promise<DailyMetricsApi[]> {
  const body = await jsonFetch<{ data: DailyMetricsApi[] }>(
    `/api/me/daily-metrics`,
  );
  return body.data ?? [];
}

export async function listDailyMetricsAsAdmin(
  code: string,
  from: string,
  to: string,
): Promise<DailyMetricsApi[]> {
  const body = await jsonFetch<{ data: DailyMetricsApi[] }>(
    `/api/admin/users/${encodeURIComponent(code)}/daily-metrics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  return body.data ?? [];
}

export async function listWeightHistoryAsAdmin(
  code: string,
): Promise<DailyMetricsApi[]> {
  const body = await jsonFetch<{ data: DailyMetricsApi[] }>(
    `/api/admin/users/${encodeURIComponent(code)}/daily-metrics`,
  );
  return body.data ?? [];
}

export async function upsertDailyMetric(patch: {
  date: string;
  weight_kg?: number | null;
  steps?: number | null;
}): Promise<void> {
  await jsonFetch(`/api/me/daily-metrics`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}
