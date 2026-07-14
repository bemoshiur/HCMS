import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { org: { select: { name: true } } },
        });
        if (!user || !user.active) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          orgId: user.orgId,
          orgName: user.org?.name ?? null,
          jurisdiction: user.jurisdiction,
          locale: user.locale,
        };
      },
    }),
  ],
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
});
