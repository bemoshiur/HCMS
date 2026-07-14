// Audit trail viewer — GET list + filters + stats + facets, and a full CSV
// export via ?format=csv. Read-only: the audit log is append-only, so there is
// no POST/PATCH/DELETE here. Restricted to audit.view (ADMIN, AUDITOR).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { toCsv, formatDateTime } from "@/lib/format";
import type { Prisma } from "@prisma/client";

const ACTOR_SELECT = { id: true, name: true, email: true, role: true } as const;

const querySchema = z.object({
  actor: z.string().trim().min(1).max(60).optional(), // userId, or "system" for null actor
  action: z.string().trim().min(1).max(120).optional(),
  entity: z.string().trim().min(1).max(120).optional(),
  from: z.string().trim().min(1).max(40).optional(),
  to: z.string().trim().min(1).max(40).optional(),
  q: z.string().trim().min(1).max(160).optional(),
  format: z.enum(["csv"]).optional(),
});

type Query = z.infer<typeof querySchema>;

function buildWhere(query: Query): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (query.actor) where.actorId = query.actor === "system" ? null : query.actor;
  if (query.action) where.action = { contains: query.action, mode: "insensitive" };
  if (query.entity) where.entity = { equals: query.entity, mode: "insensitive" };

  const at: Prisma.DateTimeFilter = {};
  if (query.from) {
    const d = new Date(query.from);
    if (!Number.isNaN(d.getTime())) at.gte = d;
  }
  if (query.to) {
    const d = new Date(query.to);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      at.lte = d;
    }
  }
  if (at.gte || at.lte) where.at = at;

  if (query.q) {
    where.OR = [
      { action: { contains: query.q, mode: "insensitive" } },
      { entity: { contains: query.q, mode: "insensitive" } },
      { entityId: { contains: query.q, mode: "insensitive" } },
      { actor: { name: { contains: query.q, mode: "insensitive" } } },
    ];
  }
  return where;
}

export async function GET(request: Request) {
  try {
    await requireCapability("audit.view");

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(
      Object.fromEntries([...searchParams.entries()].filter(([, v]) => v !== ""))
    );
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid query", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const query = parsed.data;
    const where = buildWhere(query);

    // ── Full CSV export (honours the structured filters) ──
    if (query.format === "csv") {
      const rows = await prisma.auditLog.findMany({
        where,
        orderBy: { at: "desc" },
        take: 5000,
        include: { actor: { select: ACTOR_SELECT } },
      });
      const csv = toCsv(
        [
          "Timestamp",
          "Actor",
          "Actor Email",
          "Role",
          "Action",
          "Entity",
          "Entity ID",
          "Before",
          "After",
          "IP",
        ],
        rows.map((r) => [
          formatDateTime(r.at),
          r.actor?.name ?? "System",
          r.actor?.email ?? "",
          r.actor?.role ?? "SYSTEM",
          r.action,
          r.entity,
          r.entityId ?? "",
          r.before == null ? "" : JSON.stringify(r.before),
          r.after == null ? "" : JSON.stringify(r.after),
          r.ip ?? "",
        ])
      );
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit-trail-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      items,
      total,
      today,
      actorGroups,
      byActionGroups,
      facetActions,
      facetEntities,
      facetActorRows,
    ] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { at: "desc" },
        take: 1000,
        include: { actor: { select: ACTOR_SELECT } },
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.count({ where: { AND: [where, { at: { gte: startOfToday } }] } }),
      prisma.auditLog.groupBy({ by: ["actorId"], where }),
      prisma.auditLog.groupBy({
        by: ["action"],
        where,
        _count: { _all: true },
        orderBy: { _count: { action: "desc" } },
        take: 8,
      }),
      // Facets are computed over the whole table so the filter dropdowns stay
      // stable regardless of the active filter selection.
      prisma.auditLog.findMany({
        distinct: ["action"],
        select: { action: true },
        orderBy: { action: "asc" },
      }),
      prisma.auditLog.findMany({
        distinct: ["entity"],
        select: { entity: true },
        orderBy: { entity: "asc" },
      }),
      prisma.auditLog.findMany({
        distinct: ["actorId"],
        select: { actorId: true, actor: { select: { id: true, name: true, role: true } } },
      }),
    ]);

    const actors = facetActorRows
      .filter((r) => r.actor)
      .map((r) => ({ id: r.actor!.id, name: r.actor!.name, role: r.actor!.role }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const hasSystem = facetActorRows.some((r) => r.actorId === null);

    return Response.json({
      items,
      stats: {
        total,
        today,
        distinctActors: actorGroups.length,
        byAction: byActionGroups.map((g) => ({ action: g.action, count: g._count._all })),
      },
      facets: {
        actions: facetActions.map((a) => a.action),
        entities: facetEntities.map((e) => e.entity),
        actors,
        hasSystem,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
