// Master data — navaid: PATCH fields, DELETE.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

const NAVAID_TYPES = ["VOR", "DME", "ILS_GP", "ILS_LOC", "NDB"] as const;

const patchSchema = z.object({
  type: z.enum(NAVAID_TYPES).optional(),
  name: z.string().trim().max(120).nullable().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  protectionRadiusM: z.number().min(0).max(20000).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
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

    const existing = await prisma.navaid.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: "Navaid not found" }, { status: 404 });

    const data: Prisma.NavaidUpdateInput = {};
    if (body.type !== undefined) data.type = body.type;
    if (body.name !== undefined) data.name = body.name || null;
    if (body.lat !== undefined) data.lat = body.lat;
    if (body.lon !== undefined) data.lon = body.lon;
    if (body.protectionRadiusM !== undefined) data.protectionRadiusM = body.protectionRadiusM;
    if (body.note !== undefined) data.note = body.note || null;

    const navaid = await prisma.navaid.update({ where: { id }, data });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.navaid.update",
      entity: "Navaid",
      entityId: navaid.id,
      before: {
        type: existing.type,
        name: existing.name,
        lat: existing.lat,
        lon: existing.lon,
        protectionRadiusM: existing.protectionRadiusM,
      },
      after: {
        type: navaid.type,
        name: navaid.name,
        lat: navaid.lat,
        lon: navaid.lon,
        protectionRadiusM: navaid.protectionRadiusM,
      },
    });

    return Response.json({ navaid });
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

    const existing = await prisma.navaid.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: "Navaid not found" }, { status: 404 });

    await prisma.navaid.delete({ where: { id } });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.navaid.delete",
      entity: "Navaid",
      entityId: id,
      before: { type: existing.type, name: existing.name },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
