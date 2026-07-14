// User / role management — single user: GET, PATCH (fields + password reset),
// DELETE (hard-delete only when unlinked, else 409 — prefer deactivation).
// Self-safety: an admin cannot deactivate or delete their own account.
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { ALL_ROLES } from "@/lib/auth/permissions";
import type { Prisma, Role } from "@prisma/client";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  orgId: true,
  jurisdiction: true,
  phone: true,
  locale: true,
  active: true,
  createdAt: true,
  org: { select: { id: true, name: true, type: true } },
} satisfies Prisma.UserSelect;

const ROLE_VALUES = ALL_ROLES as [Role, ...Role[]];

// ─────────────────────────────── GET ───────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireCapability("user.manage");
    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) return Response.json({ error: "User not found" }, { status: 404 });
    return Response.json({ user });
  } catch (error) {
    return apiError(error);
  }
}

// ─────────────────────────────── PATCH ───────────────────────────────

const patchSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    role: z.enum(ROLE_VALUES).optional(),
    orgId: z.string().trim().min(1).nullable().optional(),
    jurisdiction: z.string().trim().max(120).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    active: z.boolean().optional(),
    password: z.string().min(6, "Password must be at least 6 characters").max(72).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireCapability("user.manage");
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

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: "User not found" }, { status: 404 });

    // Self-safety: an admin may not deactivate their own account.
    if (id === actor.id && body.active === false) {
      return Response.json({ error: "You cannot deactivate your own account" }, { status: 403 });
    }

    if (body.orgId) {
      const org = await prisma.organization.findUnique({
        where: { id: body.orgId },
        select: { id: true },
      });
      if (!org) return Response.json({ error: "Organization not found" }, { status: 404 });
    }

    const data: Prisma.UserUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.role !== undefined) data.role = body.role;
    if (body.orgId !== undefined) {
      data.org = body.orgId ? { connect: { id: body.orgId } } : { disconnect: true };
    }
    if (body.jurisdiction !== undefined) data.jurisdiction = body.jurisdiction || null;
    if (body.phone !== undefined) data.phone = body.phone || null;
    if (body.active !== undefined) data.active = body.active;
    if (body.password !== undefined) data.passwordHash = await hash(body.password, 10);

    const user = await prisma.user.update({ where: { id }, data, select: USER_SELECT });

    // Audit — the password change is recorded as a boolean flag, never the value.
    await writeAudit({
      actorId: actor.id,
      action: body.password ? "user.resetPassword" : "user.update",
      entity: "User",
      entityId: user.id,
      before: {
        name: existing.name,
        role: existing.role,
        orgId: existing.orgId,
        jurisdiction: existing.jurisdiction,
        active: existing.active,
      },
      after: {
        name: user.name,
        role: user.role,
        orgId: user.orgId,
        jurisdiction: user.jurisdiction,
        active: user.active,
        passwordChanged: body.password ? true : undefined,
      },
    });

    return Response.json({ user });
  } catch (error) {
    return apiError(error);
  }
}

// ─────────────────────────────── DELETE ───────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireCapability("user.manage");
    const { id } = await params;

    if (id === actor.id) {
      return Response.json({ error: "You cannot delete your own account" }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            applicationsCreated: true,
            reviews: true,
            studies: true,
            certificatesSigned: true,
            documentsUploaded: true,
            assignedApplications: true,
          },
        },
      },
    });
    if (!existing) return Response.json({ error: "User not found" }, { status: 404 });

    const linked =
      existing._count.applicationsCreated +
      existing._count.reviews +
      existing._count.studies +
      existing._count.certificatesSigned +
      existing._count.documentsUploaded +
      existing._count.assignedApplications;

    if (linked > 0) {
      return Response.json(
        {
          error: `Cannot delete ${existing.name}: the account is linked to ${linked} case record(s). Deactivate it instead to preserve the audit trail.`,
        },
        { status: 409 }
      );
    }

    await prisma.user.delete({ where: { id } });

    await writeAudit({
      actorId: actor.id,
      action: "user.delete",
      entity: "User",
      entityId: id,
      before: { name: existing.name, email: existing.email, role: existing.role },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
