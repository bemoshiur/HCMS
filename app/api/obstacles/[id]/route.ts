// Single obstacle — GET detail (staff), PATCH status/remarks (obstacle.manage).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { notifyMany } from "@/lib/notify";
import type { Prisma } from "@prisma/client";

const OBSTACLE_INCLUDE = {
  airport: { select: { id: true, icao: true, name: true } },
  linkedApplication: { select: { id: true, refNo: true } },
} satisfies Prisma.ObstacleInclude;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(
      "INTAKE_OFFICER",
      "AGA_REVIEWER",
      "CNS_REVIEWER",
      "PANSOPS_REVIEWER",
      "APPROVER",
      "STUDY_OFFICER",
      "ADMIN",
      "AUDITOR"
    );
    const { id } = await params;
    const obstacle = await prisma.obstacle.findUnique({
      where: { id },
      include: OBSTACLE_INCLUDE,
    });
    if (!obstacle) return Response.json({ error: "Obstacle not found" }, { status: 404 });
    return Response.json({ obstacle });
  } catch (error) {
    return apiError(error);
  }
}

const patchSchema = z
  .object({
    status: z.enum(["COMPLIANT", "PENETRATING", "UNDER_MONITORING", "ILLEGAL"]).optional(),
    remarks: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.remarks !== undefined, {
    message: "Nothing to update",
    path: ["status"],
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCapability("obstacle.manage");
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

    const existing = await prisma.obstacle.findUnique({
      where: { id },
      include: { airport: { select: { icao: true } } },
    });
    if (!existing) return Response.json({ error: "Obstacle not found" }, { status: 404 });

    const data: Prisma.ObstacleUpdateInput = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.remarks !== undefined) data.remarks = body.remarks || null;
    // A manual status determination counts as a check on the structure.
    if (body.status !== undefined && body.status !== existing.status) {
      data.lastCheckedAt = new Date();
    }

    const obstacle = await prisma.obstacle.update({
      where: { id },
      data,
      include: OBSTACLE_INCLUDE,
    });

    await writeAudit({
      actorId: user.id,
      action: "obstacle.update",
      entity: "Obstacle",
      entityId: obstacle.id,
      before: { status: existing.status, remarks: existing.remarks },
      after: { status: obstacle.status, remarks: obstacle.remarks },
    });

    // Escalation to ILLEGAL alerts the AGA discipline for enforcement.
    if (body.status === "ILLEGAL" && existing.status !== "ILLEGAL") {
      const reviewers = await prisma.user.findMany({
        where: { role: "AGA_REVIEWER", active: true },
        select: { id: true },
      });
      await notifyMany(
        reviewers.map((u) => u.id),
        {
          event: "OBSTACLE_FLAGGED",
          title: `Obstacle flagged illegal: ${obstacle.name ?? obstacle.structureType}`,
          body: `${obstacle.structureType} near ${existing.airport.icao} has been marked illegal — enforcement action pending.`,
          link: "/obstacles/monitoring",
        }
      );
    }

    return Response.json({ obstacle });
  } catch (error) {
    return apiError(error);
  }
}
