// GET  /api/studies/[id]  — study workspace payload: study + application +
//                           latest evaluation + OLS map + nearby obstacles
//                           (shielding context, ±0.01° bounding box ≈ 1 km).
// PATCH /api/studies/[id] — save draft findings/conditions/type without
//                           completing (STUDY_OFFICER only).
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, requireCapability, apiError } from "@/lib/auth/guards";
import { loadAirport } from "@/lib/ols/server";
import { surfaceFootprints, runwayLines } from "@/lib/ols";
import { writeAudit } from "@/lib/audit";

/** Great-circle distance in metres (haversine) — for the shielding list. */
function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole("STUDY_OFFICER", "APPROVER", "ADMIN", "AUDITOR");
    const { id } = await params;

    const study = await prisma.study.findUnique({
      where: { id },
      include: {
        officer: { select: { id: true, name: true } },
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
          },
        },
      },
    });
    if (!study) return Response.json({ error: "Study not found" }, { status: 404 });

    const { evaluationResults, ...application } = study.application;

    // Shielding context — existing obstacles within roughly 1 km of the site
    const nearby = await prisma.obstacle.findMany({
      where: {
        airportId: application.airportId,
        lat: { gte: application.lat - 0.01, lte: application.lat + 0.01 },
        lon: { gte: application.lon - 0.01, lte: application.lon + 0.01 },
        NOT: { linkedApplicationId: application.id },
      },
      take: 50,
      select: {
        id: true,
        name: true,
        lat: true,
        lon: true,
        topElevationAmslM: true,
        heightAglM: true,
        structureType: true,
        status: true,
      },
    });
    const nearbyObstacles = nearby
      .map((o) => ({
        ...o,
        distanceM: Math.round(distanceM(application.lat, application.lon, o.lat, o.lon)),
      }))
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 25);

    // Map payload — footprints computed from the active parameter set
    let map: {
      center: [number, number];
      surfaces: unknown;
      runways: unknown;
      paramSetVersion: number | null;
    } | null = null;
    try {
      const loaded = await loadAirport(application.airport.icao);
      if (loaded) {
        map = {
          center: [application.airport.referenceLon, application.airport.referenceLat],
          surfaces: surfaceFootprints(loaded.ols, loaded.params),
          runways: runwayLines(loaded.ols),
          paramSetVersion: loaded.paramSetVersion,
        };
      }
    } catch {
      map = null; // decorative — never fail the workspace for it
    }

    return Response.json({
      study: {
        id: study.id,
        type: study.type,
        findings: study.findings,
        proposedConditions: study.proposedConditions,
        outcome: study.outcome,
        officer: study.officer,
        decidedAt: study.decidedAt,
        createdAt: study.createdAt,
      },
      application,
      evaluation: evaluationResults[0] ?? null,
      nearbyObstacles,
      map,
      viewer: {
        role: user.role,
        canEdit:
          user.role === "STUDY_OFFICER" &&
          study.outcome === null &&
          application.status === "STUDY",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

const patchSchema = z.object({
  type: z.enum(["AERONAUTICAL", "SHIELDING"]).optional(),
  findings: z.string().trim().max(10000).optional(),
  proposedConditions: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCapability("application.study");
    const { id } = await params;

    const json = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const study = await prisma.study.findUnique({
      where: { id },
      include: { application: { select: { id: true, status: true } } },
    });
    if (!study) return Response.json({ error: "Study not found" }, { status: 404 });
    if (study.outcome !== null) {
      return Response.json({ error: "This study is already completed" }, { status: 409 });
    }
    if (study.application.status !== "STUDY") {
      return Response.json(
        { error: `The application is ${study.application.status}, not STUDY` },
        { status: 409 }
      );
    }

    const { type, findings, proposedConditions } = parsed.data;
    const updated = await prisma.study.update({
      where: { id: study.id },
      data: {
        type: type ?? study.type,
        findings: findings !== undefined ? findings || null : study.findings,
        proposedConditions: proposedConditions ?? study.proposedConditions,
        officerId: user.id, // draft author claims the study
      },
    });

    await writeAudit({
      actorId: user.id,
      action: "study.saveDraft",
      entity: "Study",
      entityId: study.id,
      before: {
        type: study.type,
        findings: study.findings,
        proposedConditions: study.proposedConditions,
      },
      after: {
        type: updated.type,
        findings: updated.findings,
        proposedConditions: updated.proposedConditions,
      },
    });

    return Response.json({ study: updated });
  } catch (error) {
    return apiError(error);
  }
}
