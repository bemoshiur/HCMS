// GET /api/reviews — the signed-in reviewer's per-discipline queue:
// pending reviews (undecided, application UNDER_REVIEW) plus the 20 most
// recently decided, with queue KPIs. Discipline comes from the ROLE, never
// from the client.
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { reviewerDiscipline } from "@/lib/auth/permissions";

const APPLICATION_SELECT = {
  select: {
    id: true,
    refNo: true,
    status: true,
    structureType: true,
    requestedHeightAglM: true,
    slaDueAt: true,
    submittedAt: true,
    assignedDisciplines: true,
    applicantOrg: { select: { id: true, name: true } },
    airport: { select: { id: true, icao: true, name: true } },
    evaluationResults: {
      orderBy: { computedAt: "desc" as const },
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
};

type ReviewRow = {
  id: string;
  discipline: string;
  verdict: string | null;
  overrideValueAmslM: number | null;
  remarks: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  reviewer?: { id: string; name: string } | null;
  application: {
    id: string;
    refNo: string;
    status: string;
    structureType: string;
    requestedHeightAglM: number;
    slaDueAt: Date | null;
    submittedAt: Date | null;
    assignedDisciplines: string[];
    applicantOrg: { id: string; name: string };
    airport: { id: string; icao: string; name: string };
    evaluationResults: Array<{
      status: string;
      ptE_amslM: number | null;
      permissibleAglM: number | null;
      penetrationM: number | null;
      governingSurface: string | null;
    }>;
  };
};

function toItem(row: ReviewRow) {
  const { evaluationResults, ...application } = row.application;
  return {
    id: row.id,
    discipline: row.discipline,
    verdict: row.verdict,
    overrideValueAmslM: row.overrideValueAmslM,
    remarks: row.remarks,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
    reviewer: row.reviewer ?? null,
    application,
    latestEval: evaluationResults[0] ?? null,
  };
}

export async function GET() {
  try {
    const user = await requireCapability("application.review");
    const discipline = reviewerDiscipline(user.role);
    if (!discipline) {
      return Response.json({ error: "No review discipline for this role" }, { status: 403 });
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [pendingRows, decidedRows, decidedThisMonth, referredToStudy] = await Promise.all([
      prisma.disciplineReview.findMany({
        where: { discipline, verdict: null, application: { status: "UNDER_REVIEW" } },
        orderBy: { createdAt: "asc" },
        include: { application: APPLICATION_SELECT },
      }),
      prisma.disciplineReview.findMany({
        where: { discipline, verdict: { not: null } },
        orderBy: { decidedAt: "desc" },
        take: 20,
        include: {
          application: APPLICATION_SELECT,
          reviewer: { select: { id: true, name: true } },
        },
      }),
      prisma.disciplineReview.count({
        where: { discipline, verdict: { not: null }, decidedAt: { gte: monthStart } },
      }),
      prisma.disciplineReview.count({ where: { discipline, verdict: "REFER_STUDY" } }),
    ]);

    return Response.json({
      discipline,
      pending: pendingRows.map((r) => toItem(r as ReviewRow)),
      decided: decidedRows.map((r) => toItem(r as ReviewRow)),
      stats: {
        pending: pendingRows.length,
        decidedThisMonth,
        referredToStudy,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
