// Master data — structure type: PATCH fields, DELETE.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  nameBn: z.string().trim().max(120).nullable().optional(),
  active: z.boolean().optional(),
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

    const existing = await prisma.structureTypeDef.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: "Structure type not found" }, { status: 404 });

    if (body.name && body.name !== existing.name) {
      const clash = await prisma.structureTypeDef.findUnique({
        where: { name: body.name },
        select: { id: true },
      });
      if (clash) return Response.json({ error: `"${body.name}" already exists` }, { status: 409 });
    }

    const data: Prisma.StructureTypeDefUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.nameBn !== undefined) data.nameBn = body.nameBn || null;
    if (body.active !== undefined) data.active = body.active;

    const item = await prisma.structureTypeDef.update({ where: { id }, data });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.structureType.update",
      entity: "StructureTypeDef",
      entityId: item.id,
      before: { name: existing.name, nameBn: existing.nameBn, active: existing.active },
      after: { name: item.name, nameBn: item.nameBn, active: item.active },
    });

    return Response.json({ item });
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

    const existing = await prisma.structureTypeDef.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: "Structure type not found" }, { status: 404 });

    await prisma.structureTypeDef.delete({ where: { id } });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.structureType.delete",
      entity: "StructureTypeDef",
      entityId: id,
      before: { name: existing.name },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
