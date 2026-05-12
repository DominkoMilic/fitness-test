import "server-only";

export const USER_COOKIE_NAME = "kf_user_session";
export const USER_COOKIE_TTL = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret =
    process.env.USER_SESSION_SECRET?.trim() ||
    process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "Missing USER_SESSION_SECRET — set a 32-byte hex value in .env.local",
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function signUserSession(uid: string): Promise<string> {
  if (!UUID_RE.test(uid)) throw new Error("Invalid uid for session");
  const exp = Math.floor(Date.now() / 1000) + USER_COOKIE_TTL;
  const payload = `${uid}.${exp}`;
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

export async function verifyUserSession(
  token: string | undefined | null,
): Promise<{ uid: string } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [uid, expStr, sig] = parts;
  if (!UUID_RE.test(uid)) return null;
  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  const expected = await hmac(`${uid}.${exp}`);
  if (!timingSafeEqual(sig, expected)) return null;
  return { uid };
}
