// Master data — authority (Organization, type=AUTHORITY): PATCH, DELETE
// (blocked if users or applications reference it — prefer deactivation).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  nameBn: z.string().trim().max(200).nullable().optional(),
  authorityCode: z.string().trim().max(30).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  contact: z.string().trim().max(160).nullable().optional(),
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

    const existing = await prisma.organization.findFirst({ where: { id, type: "AUTHORITY" } });
    if (!existing) return Response.json({ error: "Authority not found" }, { status: 404 });

    const data: Prisma.OrganizationUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.nameBn !== undefined) data.nameBn = body.nameBn || null;
    if (body.authorityCode !== undefined) data.authorityCode = body.authorityCode || null;
    if (body.city !== undefined) data.city = body.city || null;
    if (body.contact !== undefined) data.contact = body.contact || null;
    if (body.active !== undefined) data.active = body.active;

    const org = await prisma.organization.update({ where: { id }, data });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.authority.update",
      entity: "Organization",
      entityId: org.id,
      before: {
        name: existing.name,
        authorityCode: existing.authorityCode,
        city: existing.city,
        active: existing.active,
      },
      after: {
        name: org.name,
        authorityCode: org.authorityCode,
        city: org.city,
        active: org.active,
      },
    });

    return Response.json({ authority: org });
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

    const existing = await prisma.organization.findFirst({
      where: { id, type: "AUTHORITY" },
      include: { _count: { select: { users: true, applicationsAsAuthority: true } } },
    });
    if (!existing) return Response.json({ error: "Authority not found" }, { status: 404 });

    const linked = existing._count.users + existing._count.applicationsAsAuthority;
    if (linked > 0) {
      return Response.json(
        {
          error: `Cannot delete "${existing.name}": ${existing._count.users} user(s) and ${existing._count.applicationsAsAuthority} application(s) reference it. Deactivate it instead.`,
        },
        { status: 409 }
      );
    }

    await prisma.organization.delete({ where: { id } });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.authority.delete",
      entity: "Organization",
      entityId: id,
      before: { name: existing.name, authorityCode: existing.authorityCode },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
