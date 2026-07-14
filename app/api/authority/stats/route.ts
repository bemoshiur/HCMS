// GET /api/authority/stats — approving-authority workspace payload (§17):
// jurisdiction KPIs, monthly endorsed/returned series and the org-scoped
// queue (with site addresses) in one round trip. AUTHORITY_OFFICER only.
import { prisma } from "@/lib/db";
import { requireRole, apiError } from "@/lib/auth/guards";
import { format, startOfMonth, subMonths } from "date-fns";

export async function GET() {
  try {
    const user = await requireRole("AUTHORITY_OFFICER");

    if (!user.orgId) {
      return Response.json({
        stats: { pendingEndorsement: 0, endorsedThisMonth: 0, returned: 0, totalForwarded: 0 },
        monthly: [],
        items: [],
      });
    }

    const now = new Date();
    const monthStart = startOfMonth(now);

    const [pendingEndorsement, events, rows] = await Promise.all([
      prisma.application.count({
        where: { authorityOrgId: user.orgId, status: "SUBMITTED" },
      }),
      // Endorsements / returns recorded on this authority's cases
      prisma.caseEvent.findMany({
        where: {
          type: { in: ["ENDORSED", "RETURNED_FOR_INFO"] },
          application: { authorityOrgId: user.orgId },
        },
        select: {
          type: true,
          at: true,
          applicationId: true,
          actor: { select: { orgId: true } },
        },
        orderBy: { at: "asc" },
      }),
      // Queue: everything in the jurisdiction except applicant private drafts
      prisma.application.findMany({
        where: { authorityOrgId: user.orgId, status: { not: "DRAFT" } },
        orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
        take: 500,
        include: {
          applicantOrg: { select: { id: true, name: true } },
          airport: { select: { id: true, icao: true, name: true, city: true } },
          evaluationResults: {
            orderBy: { computedAt: "desc" },
            take: 1,
            select: { status: true },
          },
        },
      }),
    ]);

    const endorsedEvents = events.filter((e) => e.type === "ENDORSED");
    // Returns driven by this authority's own officers (CAAB may also return later)
    const returnedEvents = events.filter(
      (e) => e.type === "RETURNED_FOR_INFO" && e.actor?.orgId === user.orgId
    );

    const endorsedThisMonth = endorsedEvents.filter((e) => e.at >= monthStart).length;
    const totalForwarded = new Set(endorsedEvents.map((e) => e.applicationId)).size;

    // Last six calendar months, oldest first
    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(monthStart, 5 - i);
      return { key: format(d, "yyyy-MM"), month: format(d, "MMM"), endorsed: 0, returned: 0 };
    });
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const e of endorsedEvents) {
      const bucket = byKey.get(format(e.at, "yyyy-MM"));
      if (bucket) bucket.endorsed++;
    }
    for (const e of returnedEvents) {
      const bucket = byKey.get(format(e.at, "yyyy-MM"));
      if (bucket) bucket.returned++;
    }

    const items = rows.map((a) => ({
      id: a.id,
      refNo: a.refNo,
      status: a.status,
      structureType: a.structureType,
      siteAddress: a.siteAddress,
      requestedHeightAglM: a.requestedHeightAglM,
      lat: a.lat,
      lon: a.lon,
      slaDueAt: a.slaDueAt,
      submittedAt: a.submittedAt,
      createdAt: a.createdAt,
      applicantOrg: a.applicantOrg,
      airport: a.airport,
      latestEval: a.evaluationResults[0] ?? null,
    }));

    return Response.json({
      stats: {
        pendingEndorsement,
        endorsedThisMonth,
        returned: returnedEvents.length,
        totalForwarded,
      },
      monthly: buckets.map((b) => ({
        month: b.month,
        endorsed: b.endorsed,
        returned: b.returned,
      })),
      items,
    });
  } catch (error) {
    return apiError(error);
  }
}
