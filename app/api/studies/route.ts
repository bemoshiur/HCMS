// GET /api/studies — study queue: open (outcome null) and completed buckets
// with the parent application + latest evaluation summary, plus KPIs.
import { prisma } from "@/lib/db";
import { requireRole, apiError } from "@/lib/auth/guards";

export async function GET() {
  try {
    await requireRole("STUDY_OFFICER", "APPROVER", "ADMIN", "AUDITOR");

    const rows = await prisma.study.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        officer: { select: { id: true, name: true } },
        application: {
          select: {
            id: true,
            refNo: true,
            status: true,
            structureType: true,
            requestedHeightAglM: true,
            slaDueAt: true,
            applicantOrg: { select: { id: true, name: true } },
            airport: { select: { id: true, icao: true, name: true } },
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
          },
        },
      },
    });

    const items = rows.map((s) => {
      const { evaluationResults, ...application } = s.application;
      return {
        id: s.id,
        type: s.type,
        outcome: s.outcome,
        findings: s.findings,
        proposedConditions: s.proposedConditions,
        officer: s.officer,
        decidedAt: s.decidedAt,
        createdAt: s.createdAt,
        application,
        latestEval: evaluationResults[0] ?? null,
      };
    });

    const open = items.filter((s) => s.outcome === null);
    const completed = items.filter((s) => s.outcome !== null);
    const permits = completed.filter((s) => s.outcome === "PERMIT_WITH_CONDITIONS").length;

    return Response.json({
      open,
      completed,
      stats: {
        open: open.length,
        completed: completed.length,
        permitRate: completed.length ? Math.round((permits / completed.length) * 100) : 0,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
