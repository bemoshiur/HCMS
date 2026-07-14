// POST /api/applications/[id]/evaluate — recompute the OLS evaluation
// server-side (authoritative) and store a new EvaluationResult.
import { NextRequest } from "next/server";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, apiError } from "@/lib/auth/guards";
import { addCaseEvent, writeAudit } from "@/lib/audit";
import { loadAirport } from "@/lib/ols/server";
import { evaluate } from "@/lib/ols";

const ALLOWED_ROLES: Role[] = [
  "INTAKE_OFFICER",
  "AGA_REVIEWER",
  "CNS_REVIEWER",
  "PANSOPS_REVIEWER",
  "STUDY_OFFICER",
  "ADMIN",
];

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (!ALLOWED_ROLES.includes(user.role)) {
      return Response.json(
        { error: "Forbidden: recompute is limited to intake and reviewers" },
        { status: 403 }
      );
    }
    const { id } = await params;

    const app = await prisma.application.findUnique({
      where: { id },
      include: { airport: { select: { icao: true } } },
    });
    if (!app) return Response.json({ error: "Application not found" }, { status: 404 });

    const loaded = await loadAirport(app.airport.icao);
    if (!loaded) return Response.json({ error: "Airport master data not found" }, { status: 404 });

    const result = evaluate(loaded.ols, loaded.params, {
      lat: app.lat,
      lon: app.lon,
      groundElevationM: app.groundElevationM,
      requestedHeightAglM: app.requestedHeightAglM,
    });

    const stored = await prisma.evaluationResult.create({
      data: {
        applicationId: app.id,
        governingSurface: result.governingSurface,
        ptE_amslM: result.ptE_amslM,
        permissibleAglM: result.permissibleAglM,
        penetrationM: result.penetrationM,
        status: result.status,
        surfaces: result as unknown as Prisma.InputJsonValue,
        engineVersion: result.engineVersion,
      },
    });

    await addCaseEvent({
      applicationId: app.id,
      type: "EVALUATED",
      actorId: user.id,
      note: `OLS evaluation recomputed: ${result.status}${
        result.governingSurface ? ` — governing ${result.governingSurface}` : ""
      }`,
      internal: true,
    });

    await writeAudit({
      actorId: user.id,
      action: "application.evaluate",
      entity: "Application",
      entityId: app.id,
      after: {
        status: result.status,
        ptE_amslM: result.ptE_amslM,
        governingSurface: result.governingSurface,
        engineVersion: result.engineVersion,
      },
    });

    return Response.json({ result: stored });
  } catch (error) {
    return apiError(error);
  }
}
