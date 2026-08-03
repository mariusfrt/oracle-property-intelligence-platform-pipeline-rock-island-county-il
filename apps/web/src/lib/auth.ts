const ACCESS_COOKIE = "oracle_access_token";

export function getAccessCookieName(): string {
  return ACCESS_COOKIE;
}

/**
 * Constant-time token comparison using only Edge-compatible APIs (TextEncoder).
 * Avoids node:crypto/Buffer so the gate runs in Next.js middleware (Edge runtime)
 * as well as Node route handlers. Token read from ACCESS_TOKEN env (server only,
 * never NEXT_PUBLIC_*).
 */
export function verifyAccessToken(provided: string | undefined | null): boolean {
  const expected = process.env.ACCESS_TOKEN;
  if (!expected || !provided) return false;

  const enc = new TextEncoder();
  const a = enc.encode(provided);
  const b = enc.encode(expected);
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export function getAccessTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACCESS_COOKIE}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(ACCESS_COOKIE.length + 1));
}