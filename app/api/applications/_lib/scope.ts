// Shared role-scoping helpers for the /api/applications module.
// APPLICANT → own org (or own drafts), AUTHORITY_OFFICER → own authority,
// CAAB roles → everything (list excludes private DRAFTs).
import type { Prisma, Role } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/guards";

export const CAAB_ROLES: Role[] = [
  "INTAKE_OFFICER",
  "AGA_REVIEWER",
  "CNS_REVIEWER",
  "PANSOPS_REVIEWER",
  "APPROVER",
  "STUDY_OFFICER",
  "ADMIN",
  "AUDITOR",
];

export function isCaabRole(role: Role): boolean {
  return CAAB_ROLES.includes(role);
}

/** Prisma where-clause limiting visibility to the user's scope. */
export function roleScopeWhere(user: SessionUser): Prisma.ApplicationWhereInput {
  if (user.role === "APPLICANT") {
    return {
      OR: [
        { applicantOrgId: user.orgId ?? "__none__" },
        { createdById: user.id },
      ],
    };
  }
  if (user.role === "AUTHORITY_OFFICER") {
    return { authorityOrgId: user.orgId ?? "__none__" };
  }
  // CAAB roles see everything except applicant private drafts in lists
  return { status: { not: "DRAFT" } };
}

/** May this user open a specific application? */
export function canViewApplication(
  user: SessionUser,
  app: { applicantOrgId: string; authorityOrgId: string | null; createdById: string }
): boolean {
  if (isCaabRole(user.role)) return true;
  if (user.role === "APPLICANT") {
    return app.createdById === user.id || (!!user.orgId && app.applicantOrgId === user.orgId);
  }
  if (user.role === "AUTHORITY_OFFICER") {
    return !!user.orgId && app.authorityOrgId === user.orgId;
  }
  return false;
}
