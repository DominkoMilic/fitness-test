import { supabase } from "@/lib/supabase/client";
import { todayISO } from "@/lib/utils/date";
import type { AccessCodeInsert, AccessCodeRow } from "@/types/database";

// ----- User-side operations (anon Supabase client) -------------------------

export async function loginWithCode(
  code: string,
): Promise<AccessCodeRow | null> {
  const today = todayISO();
  const { data, error } = await supabase
    .from("codes")
    .select("*")
    .eq("code", code)
    .gte("exp", today)
    .limit(1);
  if (error || !data?.length) return null;
  return data[0];
}

export async function updateGoal(userId: string, goal: number) {
  await supabase.from("codes").update({ goal }).eq("id", userId);
}

export async function recordCookieAck(userId: string) {
  await supabase
    .from("codes")
    .update({ cookies_accepted_at: new Date().toISOString() })
    .eq("id", userId);
}

// ----- Admin-only operations (server-validated cookie via API routes) ------

async function adminFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  const res = await fetch(path, {
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
  return (await res.json().catch(() => null)) as T | null;
}

export async function listCodes(): Promise<AccessCodeRow[]> {
  const body = await adminFetch<{ data: AccessCodeRow[] }>("/api/admin/codes");
  return body?.data ?? [];
}

export async function getCodeByValue(
  code: string,
): Promise<AccessCodeRow | null> {
  const body = await adminFetch<{ data: AccessCodeRow | null }>(
    `/api/admin/codes/${encodeURIComponent(code)}`,
  );
  return body?.data ?? null;
}

export async function createCode(
  input: AccessCodeInsert,
): Promise<AccessCodeRow> {
  const body = await adminFetch<{ data: AccessCodeRow }>("/api/admin/codes", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!body?.data) throw new Error("Create failed");
  return body.data;
}

export async function deleteCode(code: string) {
  await adminFetch(`/api/admin/codes/${encodeURIComponent(code)}`, {
    method: "DELETE",
  });
}

export async function updateCodeExpiry(code: string, exp: string) {
  await adminFetch(`/api/admin/codes/${encodeURIComponent(code)}`, {
    method: "PATCH",
    body: JSON.stringify({ exp }),
  });
}
