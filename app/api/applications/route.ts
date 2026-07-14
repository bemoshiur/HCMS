// GET /api/applications — role-scoped case list with filters (+ ?stats=1 KPIs).
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, apiError } from "@/lib/auth/guards";
import { ACTIVE_STATUSES } from "@/lib/workflow";
import { buildApplicationWhere, listQuerySchema } from "./_lib/filters";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();

    const raw = Object.fromEntries(
      [...request.nextUrl.searchParams.entries()].filter(([, v]) => v !== "")
    );
    const parsed = listQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid query", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const query = parsed.data;
    const { where, scope } = buildApplicationWhere(user, query);

    const rows = await prisma.application.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      take: 500,
      include: {
        applicantOrg: { select: { id: true, name: true } },
        authorityOrg: { select: { id: true, name: true } },
        airport: { select: { id: true, icao: true, name: true } },
        assignedOfficer: { select: { id: true, name: true } },
        evaluationResults: {
          orderBy: { computedAt: "desc" },
          take: 1,
          select: {
            status: true,
            ptE_amslM: true,
            permissibleAglM: true,
            penetrationM: true,
            governingSurface: true,
          },
        },
        certificates: {
          orderBy: { issuedAt: "desc" },
          take: 1,
          select: { hcNo: true, status: true },
        },
      },
    });

    const items = rows.map((a) => ({
      id: a.id,
      refNo: a.refNo,
      status: a.status,
      structureType: a.structureType,
      requestedHeightAglM: a.requestedHeightAglM,
      lat: a.lat,
      lon: a.lon,
      slaDueAt: a.slaDueAt,
      submittedAt: a.submittedAt,
      createdAt: a.createdAt,
      assignedDisciplines: a.assignedDisciplines,
      applicantOrg: a.applicantOrg,
      authorityOrg: a.authorityOrg,
      airport: a.airport,
      assignedOfficer: a.assignedOfficer,
      latestEval: a.evaluationResults[0] ?? null,
      certificate: a.certificates[0] ?? null,
    }));

    let stats: {
      inProgress: number;
      slaBreached: number;
      objections: number;
      certificatesIssued: number;
    } | null = null;

    if (query.stats) {
      const [inProgress, slaBreached, objections, certificatesIssued] = await Promise.all([
        prisma.application.count({
          where: { AND: [scope, { status: { in: ACTIVE_STATUSES } }] },
        }),
        prisma.application.count({
          where: {
            AND: [scope, { status: { in: ACTIVE_STATUSES } }, { slaDueAt: { lt: new Date() } }],
          },
        }),
        prisma.application.count({
          where: {
            AND: [scope, { evaluationResults: { some: { status: "OBJECTION" } } }],
          },
        }),
        prisma.application.count({
          where: { AND: [scope, { status: "CERTIFICATE_ISSUED" }] },
        }),
      ]);
      stats = { inProgress, slaBreached, objections, certificatesIssued };
    }

    return Response.json({ items, stats, meta: { count: items.length, cap: 500 } });
  } catch (error) {
    return apiError(error);
  }
}
