"use client";

// Admin authentication is server-side: an HMAC-signed httpOnly cookie is set
// by /api/admin/login. This module exposes a thin client-facing wrapper that
// calls the auth API routes. There is no longer any client-side password
// check or localStorage flag — the cookie is the source of truth.

const CHECK_TTL_MS = 30 * 1000;
let cachedAt = 0;
let cachedResult: boolean | null = null;

async function fetchCheck(): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/check", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return Boolean(body?.ok);
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  if (cachedResult !== null && now - cachedAt < CHECK_TTL_MS) {
    return cachedResult;
  }
  const ok = await fetchCheck();
  cachedResult = ok;
  cachedAt = now;
  return ok;
}

export async function setAdminAuthenticated(password: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password }),
    });
    const ok = res.ok;
    cachedResult = ok;
    cachedAt = Date.now();
    return ok;
  } catch {
    return false;
  }
}

export async function clearAdminAuthenticated(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    /* ignore */
  }
  cachedResult = false;
  cachedAt = Date.now();
}

// Clean up legacy localStorage flag from earlier client-side gate so the
// browser inspector no longer shows stale state.
if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem("kf_admin_authed");
  } catch {
    /* ignore */
  }
}
