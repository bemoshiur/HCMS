// Master data — fee schedule (FeeScheduleItem): GET list, POST create.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  try {
    await requireCapability("masterdata.manage");
    const items = await prisma.feeScheduleItem.findMany({
      orderBy: [{ structureType: "asc" }, { amount: "asc" }],
    });
    return Response.json({ items });
  } catch (error) {
    return apiError(error);
  }
}

const createSchema = z.object({
  structureType: z.string().trim().min(2, "Structure type is required").max(80),
  heightBandM: z.string().trim().min(1, "Height band is required").max(30),
  amount: z.number().min(0).max(10_000_000),
  currency: z.string().trim().min(2).max(6).optional(),
  active: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireCapability("masterdata.manage");

    const json = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const item = await prisma.feeScheduleItem.create({
      data: {
        structureType: body.structureType,
        heightBandM: body.heightBandM,
        amount: body.amount,
        currency: body.currency || "BDT",
        active: body.active ?? true,
      },
    });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.fee.create",
      entity: "FeeScheduleItem",
      entityId: item.id,
      after: {
        structureType: item.structureType,
        heightBandM: item.heightBandM,
        amount: item.amount,
        currency: item.currency,
        active: item.active,
      },
    });

    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
