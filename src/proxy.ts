import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** 与 @/lib/auth-constants 保持一致，避免 proxy 边界对深层模块的依赖 */
const AUTH_SESSION_COOKIE_NAME = "auth_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = Boolean(sessionCookie?.trim());

  if (pathname.startsWith("/login")) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)",
  ],
};
