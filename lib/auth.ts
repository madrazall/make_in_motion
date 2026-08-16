import { requireEnv } from "./config";

/**
 * Single-admin auth: one password, one HMAC-signed cookie.
 *
 * Deliberately not a user system — there is exactly one person who logs in.
 * Uses Web Crypto so it runs unchanged on Cloudflare Workers.
 */

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

export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = String(expires);
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(
  token: string | undefined
): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = await hmac(payload);
  if (!safeEqual(signature, expected)) return false;

  return Number(payload) > Date.now();
}

export async function checkPassword(candidate: string): Promise<boolean> {
  const expected = requireEnv("ADMIN_PASSWORD");
  // Hash both sides so the comparison length doesn't leak the real length.
  const [a, b] = await Promise.all([hmac(candidate), hmac(expected)]);
  return safeEqual(a, b);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};
