import "server-only";

export const ADMIN_COOKIE_NAME = "kf_admin_session";
export const ADMIN_COOKIE_TTL = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret =
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim();
  if (!secret) {
    throw new Error(
      "Missing ADMIN_SESSION_SECRET (or ADMIN_PASSWORD) — set one in .env.local",
    );
  }
  return secret;
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return b64url(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function signAdminSession(): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_COOKIE_TTL;
  const payload = String(exp);
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

export async function verifyAdminSession(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;
  const idx = token.indexOf(".");
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const exp = Number.parseInt(payload, 10);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = await hmac(payload);
  return timingSafeEqual(sig, expected);
}
