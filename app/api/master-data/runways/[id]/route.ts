// Master data — runway: PATCH fields (thresholds are NOT recomputed on edit),
// DELETE (cascades its thresholds).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

const APPROACH_TYPES = [
  "NON_INSTRUMENT",
  "NON_PRECISION",
  "PRECISION_I",
  "PRECISION_II",
  "PRECISION_III",
] as const;

const patchSchema = z.object({
  designator: z
    .string()
    .trim()
    .regex(/^\d{2}[LRC]?\/\d{2}[LRC]?$/i, "Use the form 14/32 or 14L/32R")
    .optional(),
  code: z.number().int().min(1).max(4).optional(),
  approachType: z.enum(APPROACH_TYPES).optional(),
  lengthM: z.number().min(100).max(10000).optional(),
  trueBearingDeg: z.number().min(0).max(360).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCapability("masterdata.manage");
    const { id } = await params;

    const json = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const existing = await prisma.runway.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: "Runway not found" }, { status: 404 });

    const data: Prisma.RunwayUpdateInput = {};
    if (body.designator !== undefined) data.designator = body.designator.toUpperCase();
    if (body.code !== undefined) data.code = body.code;
    if (body.approachType !== undefined) data.approachType = body.approachType;
    if (body.lengthM !== undefined) data.lengthM = body.lengthM;
    if (body.trueBearingDeg !== undefined) data.trueBearingDeg = body.trueBearingDeg;

    // Editing a runway does NOT auto-recompute thresholds — they are kept as-is.
    const runway = await prisma.runway.update({
      where: { id },
      data,
      include: { thresholds: { orderBy: { name: "asc" } } },
    });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.runway.update",
      entity: "Runway",
      entityId: runway.id,
      before: {
        designator: existing.designator,
        code: existing.code,
        approachType: existing.approachType,
        lengthM: existing.lengthM,
        trueBearingDeg: existing.trueBearingDeg,
      },
      after: {
        designator: runway.designator,
        code: runway.code,
        approachType: runway.approachType,
        lengthM: runway.lengthM,
        trueBearingDeg: runway.trueBearingDeg,
      },
    });

    return Response.json({ runway });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCapability("masterdata.manage");
    const { id } = await params;

    const existing = await prisma.runway.findUnique({
      where: { id },
      include: { airport: { select: { icao: true } } },
    });
    if (!existing) return Response.json({ error: "Runway not found" }, { status: 404 });

    await prisma.runway.delete({ where: { id } });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.runway.delete",
      entity: "Runway",
      entityId: id,
      before: { airport: existing.airport.icao, designator: existing.designator },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
