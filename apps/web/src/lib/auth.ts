import { timingSafeEqual } from "node:crypto";

const ACCESS_COOKIE = "oracle_access_token";

export function getAccessCookieName(): string {
  return ACCESS_COOKIE;
}

/**
 * Constant-time comparison of access token.
 * Token is read from ACCESS_TOKEN env (server) — never embedded in client bundle.
 */
export function verifyAccessToken(provided: string | undefined | null): boolean {
  const expected = process.env.ACCESS_TOKEN;
  if (!expected || !provided) return false;

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
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
