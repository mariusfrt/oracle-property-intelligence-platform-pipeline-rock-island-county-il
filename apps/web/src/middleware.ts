import { NextResponse, type NextRequest } from "next/server";
import { getAccessCookieName, getAccessTokenFromCookie, verifyAccessToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/login", "/api/logout"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = getAccessTokenFromCookie(request.headers.get("cookie"));
  if (!verifyAccessToken(token)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
