import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      orgId: string | null;
      orgName: string | null;
      jurisdiction: string | null;
      locale: string;
    };
  }
  interface User {
    role: Role;
    orgId: string | null;
    orgName: string | null;
    jurisdiction: string | null;
    locale: string;
  }
}

/**
 * Edge-safe Auth.js config — NO Prisma / bcrypt imports, so it can run in
 * middleware. The Credentials provider (which needs Prisma) is added only in
 * auth.ts. JWT signing/verification and the callbacks live here and are shared,
 * so middleware can decode the session token and read the role.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [], // real providers added in auth.ts
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.orgId = user.orgId;
        token.orgName = user.orgName;
        token.jurisdiction = user.jurisdiction;
        token.locale = user.locale;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.orgId = (token.orgId as string | null) ?? null;
        session.user.orgName = (token.orgName as string | null) ?? null;
        session.user.jurisdiction = (token.jurisdiction as string | null) ?? null;
        session.user.locale = (token.locale as string) ?? "en";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
