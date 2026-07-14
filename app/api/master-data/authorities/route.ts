// Master data — approving authorities (Organization, type=AUTHORITY):
// GET list, POST create.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  try {
    await requireCapability("masterdata.manage");
    const items = await prisma.organization.findMany({
      where: { type: "AUTHORITY" },
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true, applicationsAsAuthority: true } } },
    });
    return Response.json({
      items: items.map((o) => ({
        id: o.id,
        name: o.name,
        nameBn: o.nameBn,
        authorityCode: o.authorityCode,
        city: o.city,
        contact: o.contact,
        active: o.active,
        userCount: o._count.users,
        applicationCount: o._count.applicationsAsAuthority,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(160),
  nameBn: z.string().trim().max(200).optional(),
  authorityCode: z.string().trim().max(30).optional(),
  city: z.string().trim().max(80).optional(),
  contact: z.string().trim().max(160).optional(),
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

    const org = await prisma.organization.create({
      data: {
        type: "AUTHORITY",
        name: body.name,
        nameBn: body.nameBn || null,
        authorityCode: body.authorityCode || null,
        city: body.city || null,
        contact: body.contact || null,
        active: body.active ?? true,
      },
    });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.authority.create",
      entity: "Organization",
      entityId: org.id,
      after: { name: org.name, authorityCode: org.authorityCode, city: org.city, active: org.active },
    });

    return Response.json({ authority: org }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
