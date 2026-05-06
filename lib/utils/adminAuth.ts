const ADMIN_AUTH_KEY = "kf_admin_authed";

export function isAdminAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_AUTH_KEY) === "1";
}

export function setAdminAuthenticated(password: string): boolean {
  if (typeof window === "undefined") return false;
  const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim();
  if (!expected) return false;
  const ok = password === expected;
  if (ok) localStorage.setItem(ADMIN_AUTH_KEY, "1");
  return ok;
}

export function clearAdminAuthenticated() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_AUTH_KEY);
}
