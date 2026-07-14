// Master data — fee schedule item: PATCH, DELETE.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

const patchSchema = z.object({
  structureType: z.string().trim().min(2).max(80).optional(),
  heightBandM: z.string().trim().min(1).max(30).optional(),
  amount: z.number().min(0).max(10_000_000).optional(),
  currency: z.string().trim().min(2).max(6).optional(),
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

    const existing = await prisma.feeScheduleItem.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: "Fee item not found" }, { status: 404 });

    const data: Prisma.FeeScheduleItemUpdateInput = {};
    if (body.structureType !== undefined) data.structureType = body.structureType;
    if (body.heightBandM !== undefined) data.heightBandM = body.heightBandM;
    if (body.amount !== undefined) data.amount = body.amount;
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.active !== undefined) data.active = body.active;

    const item = await prisma.feeScheduleItem.update({ where: { id }, data });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.fee.update",
      entity: "FeeScheduleItem",
      entityId: item.id,
      before: {
        structureType: existing.structureType,
        heightBandM: existing.heightBandM,
        amount: existing.amount,
        currency: existing.currency,
        active: existing.active,
      },
      after: {
        structureType: item.structureType,
        heightBandM: item.heightBandM,
        amount: item.amount,
        currency: item.currency,
        active: item.active,
      },
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

    const existing = await prisma.feeScheduleItem.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: "Fee item not found" }, { status: 404 });

    await prisma.feeScheduleItem.delete({ where: { id } });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.fee.delete",
      entity: "FeeScheduleItem",
      entityId: id,
      before: {
        structureType: existing.structureType,
        heightBandM: existing.heightBandM,
        amount: existing.amount,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
