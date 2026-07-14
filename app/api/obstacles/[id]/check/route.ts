// OLS compliance re-check for a registered obstacle (obstacle.manage).
// Runs the engine at the obstacle's position with the recorded top elevation:
// evaluate(groundElevationM = topElevationAmslM, requestedHeightAglM = 0) makes
// requestedTop equal the obstacle top, so OBJECTION ⇔ the top penetrates the
// governing PTE (min of AGA surfaces and CNS/PANS-OPS limits).
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { loadAirport } from "@/lib/ols/server";
import { evaluate } from "@/lib/ols";
import type { ObstacleStatus, Prisma } from "@prisma/client";

const OBSTACLE_INCLUDE = {
  airport: { select: { id: true, icao: true, name: true } },
  linkedApplication: { select: { id: true, refNo: true } },
} satisfies Prisma.ObstacleInclude;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCapability("obstacle.manage");
    const { id } = await params;

    const obstacle = await prisma.obstacle.findUnique({
      where: { id },
      include: { airport: { select: { icao: true } } },
    });
    if (!obstacle) return Response.json({ error: "Obstacle not found" }, { status: 404 });

    const airport = await loadAirport(obstacle.airport.icao);
    if (!airport) {
      return Response.json(
        { error: "Airport master data unavailable for this obstacle" },
        { status: 409 }
      );
    }

    const evaluation = evaluate(airport.ols, airport.params, {
      lat: obstacle.lat,
      lon: obstacle.lon,
      groundElevationM: obstacle.topElevationAmslM,
      requestedHeightAglM: 0,
    });

    const penetrates = evaluation.status === "OBJECTION";
    // ILLEGAL is an enforcement determination — a geometry re-check never clears it.
    const nextStatus: ObstacleStatus =
      obstacle.status === "ILLEGAL"
        ? "ILLEGAL"
        : penetrates
          ? "PENETRATING"
          : "COMPLIANT";

    const updated = await prisma.obstacle.update({
      where: { id },
      data: { status: nextStatus, lastCheckedAt: new Date() },
      include: OBSTACLE_INCLUDE,
    });

    await writeAudit({
      actorId: user.id,
      action: "obstacle.check",
      entity: "Obstacle",
      entityId: obstacle.id,
      before: { status: obstacle.status, lastCheckedAt: obstacle.lastCheckedAt },
      after: {
        status: updated.status,
        lastCheckedAt: updated.lastCheckedAt,
        evaluation: {
          status: evaluation.status,
          ptE_amslM: evaluation.ptE_amslM,
          penetrationM: evaluation.penetrationM,
          governingSurface: evaluation.governingSurface,
          governingDomain: evaluation.governingDomain,
          engineVersion: evaluation.engineVersion,
        },
      },
    });

    return Response.json({ obstacle: updated, evaluation });
  } catch (error) {
    return apiError(error);
  }
}
