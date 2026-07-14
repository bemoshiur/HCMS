import { NextResponse, type NextRequest } from "next/server";

// Lightweight cookie-presence gate for authenticated areas.
// Authoritative auth + role checks happen in the (app) layout and in every
// API route via lib/auth/guards (middleware stays edge-safe: no Prisma).

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/applications",
  "/portal",
  "/authority",
  "/evaluate",
  "/review",
  "/studies",
  "/certificates",
  "/obstacles",
  "/reports",
  "/master-data",
  "/users",
  "/audit",
  "/settings",
  "/notifications",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!isProtected) return NextResponse.next();

  const hasSession =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token");

  if (!hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
