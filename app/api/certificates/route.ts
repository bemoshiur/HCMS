// GET /api/certificates — certificate register + KPI stats + APPROVED queue.
// Staff-only (mirrors ROUTE_ACCESS["/certificates"]). Filters: ?airport=ICAO&status=CertStatus.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, apiError } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import type { Prisma } from "@prisma/client";

const querySchema = z.object({
  airport: z.string().trim().min(2).max(8).optional(),
  status: z.enum(["ISSUED", "REVOKED", "EXPIRED", "SUPERSEDED"]).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireRole("APPROVER", "ADMIN", "AUDITOR", "INTAKE_OFFICER");
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      airport: searchParams.get("airport") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const where: Prisma.CertificateWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.airport) {
      where.application = { airport: { icao: { equals: query.airport, mode: "insensitive" } } };
    }

    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const canManage = can(user.role, "certificate.manage");

    const [certs, byStatus, expiring90, approved] = await Promise.all([
      prisma.certificate.findMany({
        where,
        orderBy: { issuedAt: "desc" },
        include: {
          application: {
            select: {
              id: true,
              refNo: true,
              structureType: true,
              applicantOrg: { select: { name: true } },
              airport: { select: { icao: true, name: true } },
            },
          },
          signedBy: { select: { name: true } },
        },
      }),
      prisma.certificate.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.certificate.count({
        where: { status: "ISSUED", validTo: { gte: now, lte: in90Days } },
      }),
      prisma.application.findMany({
        where: { status: "APPROVED" },
        orderBy: { updatedAt: "asc" },
        select: {
          id: true,
          refNo: true,
          structureType: true,
          requestedHeightAglM: true,
          decidedAt: true,
          updatedAt: true,
          applicantOrg: { select: { name: true } },
          airport: { select: { icao: true, name: true } },
          evaluationResults: {
            orderBy: { computedAt: "desc" },
            take: 1,
            select: { ptE_amslM: true, permissibleAglM: true, governingSurface: true, status: true },
          },
        },
      }),
    ]);

    const count = (status: string) =>
      byStatus.find((s) => s.status === status)?._count._all ?? 0;

    return Response.json({
      canManage,
      stats: {
        issued: count("ISSUED"),
        expiring90,
        revoked: count("REVOKED"),
        expired: count("EXPIRED"),
      },
      certificates: certs.map((c) => ({
        id: c.id,
        hcNo: c.hcNo,
        status: c.status,
        decision: c.decision,
        ptE_amslM: c.ptE_amslM,
        permissibleAglM: c.permissibleAglM,
        governingSurface: c.governingSurface,
        conditions: c.conditions,
        validFrom: c.validFrom,
        validTo: c.validTo,
        issuedAt: c.issuedAt,
        signedByName: c.signedBy?.name ?? null,
        supersededById: c.supersededById,
        application: {
          id: c.application.id,
          refNo: c.application.refNo,
          structureType: c.application.structureType,
          applicant: c.application.applicantOrg.name,
          airportIcao: c.application.airport.icao,
          airportName: c.application.airport.name,
        },
      })),
      approvedAwaiting: approved.map((a) => ({
        id: a.id,
        refNo: a.refNo,
        structureType: a.structureType,
        requestedHeightAglM: a.requestedHeightAglM,
        applicant: a.applicantOrg.name,
        airportIcao: a.airport.icao,
        airportName: a.airport.name,
        decidedAt: a.decidedAt ?? a.updatedAt,
        evaluation: a.evaluationResults[0] ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid query", issues: error.issues }, { status: 400 });
    }
    return apiError(error);
  }
}
