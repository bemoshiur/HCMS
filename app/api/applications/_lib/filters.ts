// Shared query-param parsing + Prisma where-builder for list & CSV export.
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/guards";
import { ACTIVE_STATUSES } from "@/lib/workflow";
import { roleScopeWhere } from "./scope";

export const APPLICATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "ENDORSED",
  "INTAKE_SCRUTINY",
  "UNDER_REVIEW",
  "STUDY",
  "DECISION_PENDING",
  "APPROVED",
  "REJECTED",
  "RETURNED_FOR_INFO",
  "CERTIFICATE_ISSUED",
  "REVALIDATION",
  "EXPIRED",
  "REVOKED",
] as const;

export const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  icao: z.string().trim().max(4).optional(),
  status: z.enum(APPLICATION_STATUSES).optional(),
  structureType: z.string().trim().max(80).optional(),
  authorityOrgId: z.string().trim().max(64).optional(),
  from: z.string().trim().optional(), // ISO date (yyyy-mm-dd)
  to: z.string().trim().optional(),
  slaBreached: z.enum(["1", "true"]).optional(),
  stats: z.enum(["1", "true"]).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export function buildApplicationWhere(
  user: SessionUser,
  query: ListQuery
): { where: Prisma.ApplicationWhereInput; scope: Prisma.ApplicationWhereInput } {
  const scope = roleScopeWhere(user);
  const filters: Prisma.ApplicationWhereInput[] = [scope];

  if (query.q) {
    filters.push({
      OR: [
        { refNo: { contains: query.q, mode: "insensitive" } },
        { structureType: { contains: query.q, mode: "insensitive" } },
        { siteAddress: { contains: query.q, mode: "insensitive" } },
        { applicantOrg: { name: { contains: query.q, mode: "insensitive" } } },
      ],
    });
  }
  if (query.icao) filters.push({ airport: { icao: query.icao.toUpperCase() } });
  if (query.status) filters.push({ status: query.status });
  if (query.structureType) filters.push({ structureType: query.structureType });
  if (query.authorityOrgId) filters.push({ authorityOrgId: query.authorityOrgId });
  if (query.from) {
    const from = new Date(query.from);
    if (!Number.isNaN(from.getTime())) filters.push({ submittedAt: { gte: from } });
  }
  if (query.to) {
    const to = new Date(query.to);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      filters.push({ submittedAt: { lte: to } });
    }
  }
  if (query.slaBreached) {
    filters.push({ slaDueAt: { lt: new Date() }, status: { in: ACTIVE_STATUSES } });
  }

  return { where: { AND: filters }, scope };
}
