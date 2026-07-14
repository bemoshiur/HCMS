// User / role management — GET list (+ stats + org options), POST create.
// ADMIN only (user.manage). Passwords are hashed with bcryptjs; passwordHash
// is NEVER returned. Every mutation is audited.
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { ALL_ROLES } from "@/lib/auth/permissions";
import type { Prisma, Role } from "@prisma/client";

// Selection that deliberately excludes passwordHash.
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

// ─────────────────────────────── GET (list) ───────────────────────────────

const querySchema = z.object({
  role: z.enum(ROLE_VALUES).optional(),
  active: z.enum(["true", "false"]).optional(),
  q: z.string().trim().min(1).max(120).optional(),
});

export async function GET(request: Request) {
  try {
    await requireCapability("user.manage");

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      role: searchParams.get("role") ?? undefined,
      active: searchParams.get("active") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    });
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid query", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const query = parsed.data;

    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.active) where.active = query.active === "true";
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q, mode: "insensitive" } },
        { jurisdiction: { contains: query.q, mode: "insensitive" } },
        { org: { name: { contains: query.q, mode: "insensitive" } } },
      ];
    }

    const [items, byRole, total, activeCount, orgs] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, select: USER_SELECT }),
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.organization.findMany({
        orderBy: [{ type: "asc" }, { name: "asc" }],
        select: { id: true, name: true, type: true, active: true },
      }),
    ]);

    const roleCounts = Object.fromEntries(
      ALL_ROLES.map((r) => [r, byRole.find((b) => b.role === r)?._count._all ?? 0])
    ) as Record<Role, number>;

    return Response.json({
      items,
      orgs,
      stats: { total, active: activeCount, inactive: total - activeCount, byRole: roleCounts },
    });
  } catch (error) {
    return apiError(error);
  }
}

// ─────────────────────────────── POST (create) ───────────────────────────────

const createSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
  role: z.enum(ROLE_VALUES),
  orgId: z.string().trim().min(1).nullable().optional(),
  jurisdiction: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

export async function POST(request: Request) {
  try {
    const actor = await requireCapability("user.manage");

    const json = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (existing) {
      return Response.json({ error: `A user with email ${body.email} already exists` }, { status: 409 });
    }

    if (body.orgId) {
      const org = await prisma.organization.findUnique({
        where: { id: body.orgId },
        select: { id: true },
      });
      if (!org) return Response.json({ error: "Organization not found" }, { status: 404 });
    }

    const passwordHash = await hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        role: body.role,
        orgId: body.orgId || null,
        jurisdiction: body.jurisdiction || null,
        phone: body.phone || null,
      },
      select: USER_SELECT,
    });

    await writeAudit({
      actorId: actor.id,
      action: "user.create",
      entity: "User",
      entityId: user.id,
      after: {
        name: user.name,
        email: user.email,
        role: user.role,
        orgId: user.orgId,
        jurisdiction: user.jurisdiction,
        active: user.active,
      },
    });

    return Response.json({ user }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
