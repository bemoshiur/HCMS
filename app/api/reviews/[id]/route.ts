// GET /api/reviews/[id] — full review console payload: the review, its
// application, the latest evaluation (full per-surface JSON), sibling
// discipline reviews and the OLS map footprints (server-computed).
// Reviewers may open only reviews in their own discipline.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { reviewerDiscipline } from "@/lib/auth/permissions";
import { loadAirport } from "@/lib/ols/server";
import { surfaceFootprints, runwayLines } from "@/lib/ols";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCapability("application.review");
    const discipline = reviewerDiscipline(user.role);
    if (!discipline) {
      return Response.json({ error: "No review discipline for this role" }, { status: 403 });
    }
    const { id } = await params;

    const review = await prisma.disciplineReview.findUnique({
      where: { id },
      include: {
        reviewer: { select: { id: true, name: true } },
        application: {
          include: {
            applicantOrg: { select: { id: true, name: true, city: true, contact: true } },
            authorityOrg: { select: { id: true, name: true, authorityCode: true } },
            airport: {
              select: {
                id: true,
                icao: true,
                name: true,
                city: true,
                elevationM: true,
                referenceLat: true,
                referenceLon: true,
              },
            },
            assignedOfficer: { select: { id: true, name: true } },
            evaluationResults: { orderBy: { computedAt: "desc" }, take: 1 },
            disciplineReviews: {
              orderBy: { discipline: "asc" },
              include: { reviewer: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    if (!review) return Response.json({ error: "Review not found" }, { status: 404 });
    if (review.discipline !== discipline) {
      return Response.json(
        { error: "Forbidden: this review belongs to a different discipline" },
        { status: 403 }
      );
    }

    const {
      evaluationResults,
      disciplineReviews,
      ...application
    } = review.application;

    // Map payload — footprints computed from the active parameter set
    let map: {
      center: [number, number];
      surfaces: unknown;
      runways: unknown;
      navaids: Array<{ lat: number; lon: number; type: string; name: string | null }>;
      paramSetVersion: number | null;
    } | null = null;
    try {
      const loaded = await loadAirport(application.airport.icao);
      if (loaded) {
        map = {
          center: [application.airport.referenceLon, application.airport.referenceLat],
          surfaces: surfaceFootprints(loaded.ols, loaded.params),
          runways: runwayLines(loaded.ols),
          navaids: loaded.navaids.map((n) => ({
            lat: n.lat,
            lon: n.lon,
            type: n.type,
            name: n.name,
          })),
          paramSetVersion: loaded.paramSetVersion,
        };
      }
    } catch {
      map = null; // map is decorative — never fail the console for it
    }

    return Response.json({
      review: {
        id: review.id,
        discipline: review.discipline,
        verdict: review.verdict,
        overrideValueAmslM: review.overrideValueAmslM,
        remarks: review.remarks,
        decidedAt: review.decidedAt,
        createdAt: review.createdAt,
        reviewer: review.reviewer,
      },
      application,
      evaluation: evaluationResults[0] ?? null,
      siblingReviews: disciplineReviews,
      map,
      viewer: {
        discipline,
        canDecide: review.verdict === null && application.status === "UNDER_REVIEW",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
