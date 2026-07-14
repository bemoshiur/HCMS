// Shared client types + helpers for the User / role management module.
// Mirrors the /api/users route contracts.
import { ALL_ROLES } from "@/lib/auth/permissions";
import type { Role } from "@prisma/client";

export type { Role };
export { ALL_ROLES };

export type OrgType = "APPLICANT" | "AUTHORITY" | "CAAB";

export type OrgOption = {
  id: string;
  name: string;
  type: OrgType;
  active: boolean;
};

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  orgId: string | null;
  jurisdiction: string | null;
  phone: string | null;
  locale: string;
  active: boolean;
  createdAt: string;
  org: { id: string; name: string; type: OrgType } | null;
};

export type UsersPayload = {
  items: UserRow[];
  orgs: OrgOption[];
  stats: {
    total: number;
    active: number;
    inactive: number;
    byRole: Record<Role, number>;
  };
};

export const ROLE_LABELS: Record<Role, string> = {
  APPLICANT: "Applicant",
  AUTHORITY_OFFICER: "Authority Officer",
  INTAKE_OFFICER: "Intake Officer",
  AGA_REVIEWER: "AGA Reviewer",
  CNS_REVIEWER: "CNS Reviewer",
  PANSOPS_REVIEWER: "PANS-OPS Reviewer",
  APPROVER: "Approver",
  STUDY_OFFICER: "Study Officer",
  ADMIN: "Administrator",
  AUDITOR: "Auditor",
};

export const DEMO_PASSWORD = "Demo@1234";

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (body as { error?: string } | null)?.error ?? `Request failed (${res.status})`
    );
  }
  return body as T;
}

export function jsonBody(payload: unknown, method = "POST"): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}
