// Server-side authorization guards — use in EVERY API route / server action.
// Never trust the client role.
import { auth } from "@/auth";
import type { Role } from "@prisma/client";
import { can, type Capability } from "./permissions";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  orgId: string | null;
  orgName: string | null;
  jurisdiction: string | null;
  locale: string;
};

/** Returns the signed-in user or throws 401. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) throw new AuthError("Not authenticated", 401);
  return session.user as SessionUser;
}

/** Returns the user if they hold the capability, else throws 401/403. */
export async function requireCapability(capability: Capability): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, capability)) {
    throw new AuthError(`Forbidden: requires ${capability}`, 403);
  }
  return user;
}

/** Returns the user if their role is in the allow-list, else throws. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AuthError("Forbidden", 403);
  return user;
}

/** Wraps an API handler body, converting AuthError/Error into JSON responses. */
export function apiError(error: unknown): Response {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
