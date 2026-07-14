import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { authConfig } from "@/auth.config";
import { canAccessRoute, ROLE_HOME } from "@/lib/auth/permissions";

// Edge-safe Auth.js instance (no Prisma) — decodes the JWT to read the role and
// enforce role-based route access at the edge, before any page renders.
const { auth } = NextAuth(authConfig);

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

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!isProtected) return NextResponse.next();

  const user = request.auth?.user;
  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  // Authoritative per-route role guard (mirrors the (app) layout check).
  if (!canAccessRoute(user.role as Role, pathname)) {
    return NextResponse.redirect(
      new URL(ROLE_HOME[user.role as Role] ?? "/dashboard", request.url)
    );
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
