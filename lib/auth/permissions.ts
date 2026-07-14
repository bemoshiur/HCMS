// Central RBAC — the single source of truth for role capabilities (§11 of the brief).
// Enforced in BOTH the UI (hide/disable) and every API route / server action.
import type { Role } from "@prisma/client";

export const ALL_ROLES: Role[] = [
  "APPLICANT",
  "AUTHORITY_OFFICER",
  "INTAKE_OFFICER",
  "AGA_REVIEWER",
  "CNS_REVIEWER",
  "PANSOPS_REVIEWER",
  "APPROVER",
  "STUDY_OFFICER",
  "ADMIN",
  "AUDITOR",
];

export type Capability =
  | "public.heightCheck" // everyone incl. unauthenticated
  | "application.create"
  | "application.endorse" // approving authority endorse/forward/return
  | "application.intake" // scrutiny, accept/return, assign disciplines
  | "application.review" // discipline review (own domain enforced separately)
  | "application.study" // aeronautical / shielding study
  | "application.decide" // final decision / sign
  | "certificate.manage" // issue / revoke / revalidate / supersede
  | "obstacle.manage"
  | "masterdata.manage"
  | "user.manage"
  | "report.view" // scope (own/jurisdiction/all) applied in queries
  | "audit.view"
  | "settings.manage";

const MATRIX: Record<Capability, Role[]> = {
  "public.heightCheck": ALL_ROLES,
  "application.create": ["APPLICANT", "AUTHORITY_OFFICER"],
  "application.endorse": ["AUTHORITY_OFFICER"],
  "application.intake": ["INTAKE_OFFICER", "ADMIN"],
  "application.review": ["AGA_REVIEWER", "CNS_REVIEWER", "PANSOPS_REVIEWER"],
  "application.study": ["STUDY_OFFICER"],
  "application.decide": ["APPROVER"],
  "certificate.manage": ["APPROVER", "ADMIN"],
  "obstacle.manage": ["INTAKE_OFFICER", "AGA_REVIEWER", "ADMIN"],
  "masterdata.manage": ["ADMIN"],
  "user.manage": ["ADMIN"],
  "report.view": ALL_ROLES,
  "audit.view": ["ADMIN", "AUDITOR"],
  "settings.manage": ["ADMIN"],
};

export function can(role: Role | undefined | null, capability: Capability): boolean {
  if (!role) return capability === "public.heightCheck";
  return MATRIX[capability]?.includes(role) ?? false;
}

/** Discipline a reviewer role owns (for "own domain" checks). */
export function reviewerDiscipline(role: Role): "AGA" | "CNS" | "PANSOPS" | null {
  switch (role) {
    case "AGA_REVIEWER":
      return "AGA";
    case "CNS_REVIEWER":
      return "CNS";
    case "PANSOPS_REVIEWER":
      return "PANSOPS";
    default:
      return null;
  }
}

// ─────────────────────── Route access (sidebar + guards) ───────────────────────

/** App-shell routes each role may access. Drives nav visibility AND layout guards. */
export const ROUTE_ACCESS: Record<string, Role[]> = {
  "/dashboard": ALL_ROLES,
  "/applications": ["INTAKE_OFFICER", "APPROVER", "ADMIN", "AUDITOR", "AGA_REVIEWER", "CNS_REVIEWER", "PANSOPS_REVIEWER", "STUDY_OFFICER"],
  "/portal": ["APPLICANT"],
  "/authority": ["AUTHORITY_OFFICER"],
  "/evaluate": ["INTAKE_OFFICER", "AGA_REVIEWER", "CNS_REVIEWER", "PANSOPS_REVIEWER", "APPROVER", "STUDY_OFFICER", "ADMIN", "AUDITOR"],
  "/review": ["AGA_REVIEWER", "CNS_REVIEWER", "PANSOPS_REVIEWER"],
  "/studies": ["STUDY_OFFICER", "APPROVER", "ADMIN", "AUDITOR"],
  "/certificates": ["APPROVER", "ADMIN", "AUDITOR", "INTAKE_OFFICER"],
  "/obstacles": ["INTAKE_OFFICER", "AGA_REVIEWER", "ADMIN", "AUDITOR", "APPROVER"],
  "/reports": ALL_ROLES,
  "/master-data": ["ADMIN"],
  "/users": ["ADMIN"],
  "/audit": ["ADMIN", "AUDITOR"],
  "/settings": ALL_ROLES, // per-user profile; system tab gated to ADMIN inside
  "/notifications": ALL_ROLES,
};

export function canAccessRoute(role: Role | undefined | null, pathname: string): boolean {
  if (!role) return false;
  const entry = Object.keys(ROUTE_ACCESS)
    .sort((a, b) => b.length - a.length)
    .find((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
  if (!entry) return true; // unlisted app routes default to authenticated
  return ROUTE_ACCESS[entry].includes(role);
}

/** Default landing page per role after sign-in. */
export const ROLE_HOME: Record<Role, string> = {
  APPLICANT: "/portal",
  AUTHORITY_OFFICER: "/authority",
  INTAKE_OFFICER: "/dashboard",
  AGA_REVIEWER: "/review",
  CNS_REVIEWER: "/review",
  PANSOPS_REVIEWER: "/review",
  APPROVER: "/dashboard",
  STUDY_OFFICER: "/studies",
  ADMIN: "/dashboard",
  AUDITOR: "/dashboard",
};
