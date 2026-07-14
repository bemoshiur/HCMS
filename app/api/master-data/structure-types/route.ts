// Master data — structure types: GET list, POST create.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  try {
    await requireCapability("masterdata.manage");
    const items = await prisma.structureTypeDef.findMany({ orderBy: { name: "asc" } });
    return Response.json({ items });
  } catch (error) {
    return apiError(error);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  nameBn: z.string().trim().max(120).optional(),
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

    const existing = await prisma.structureTypeDef.findUnique({
      where: { name: body.name },
      select: { id: true },
    });
    if (existing) {
      return Response.json({ error: `"${body.name}" already exists` }, { status: 409 });
    }

    const item = await prisma.structureTypeDef.create({
      data: { name: body.name, nameBn: body.nameBn || null, active: body.active ?? true },
    });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.structureType.create",
      entity: "StructureTypeDef",
      entityId: item.id,
      after: { name: item.name, nameBn: item.nameBn, active: item.active },
    });

    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
