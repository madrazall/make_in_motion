import { requireEnv } from "./config";

/**
 * Two-role auth: one password for full admin, one separate password for the
 * content calendar only. Still not a user system — no accounts, no per-person
 * identity — just two shared passwords with different reach, so the content
 * calendar can be handed off to someone else without giving them guest lists,
 * revenue, or the ability to delete an event.
 *
 * Uses Web Crypto so it runs unchanged on Cloudflare Workers.
 */

export type Role = "admin" | "content";

export const SESSION_COOKIE = "mim_admin";
const SESSION_DAYS = 14;

function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requireEnv("SESSION_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return bytesToHex(sig);
}

/** Constant-time comparison — avoids leaking the signature via timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(role: Role): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  // Colon inside the payload, dot between payload and signature — the two
  // separators can't collide since neither role nor the timestamp contains one.
  const payload = `${role}:${expires}`;
  return `${payload}.${await hmac(payload)}`;
}

/** Returns the authenticated role, or null if the token is missing/invalid/expired. */
export async function verifySessionToken(
  token: string | undefined
): Promise<Role | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = await hmac(payload);
  if (!safeEqual(signature, expected)) return null;

  const [role, expires] = payload.split(":");
  if ((role !== "admin" && role !== "content") || !expires) return null;
  if (Number(expires) <= Date.now()) return null;

  return role;
}

async function checkAgainst(candidate: string, expected: string): Promise<boolean> {
  // Hash both sides so the comparison length doesn't leak the real length.
  const [a, b] = await Promise.all([hmac(candidate), hmac(expected)]);
  return safeEqual(a, b);
}

export async function checkPassword(candidate: string): Promise<boolean> {
  return checkAgainst(candidate, requireEnv("ADMIN_PASSWORD"));
}

export async function checkContentPassword(candidate: string): Promise<boolean> {
  return checkAgainst(candidate, requireEnv("CONTENT_PASSWORD"));
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};
