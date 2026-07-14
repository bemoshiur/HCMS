// Obstacle register — GET list + stats (staff), POST create (obstacle.manage).
// Sources: CERTIFIED (from issued certificates), SURVEY, COMPLAINT.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, requireCapability, apiError } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { writeAudit } from "@/lib/audit";
import { notifyMany } from "@/lib/notify";
import { loadAirport } from "@/lib/ols/server";
import { evaluate } from "@/lib/ols";
import type { ObstacleStatus, Prisma } from "@prisma/client";

const OBSTACLE_INCLUDE = {
  airport: { select: { id: true, icao: true, name: true } },
  linkedApplication: { select: { id: true, refNo: true } },
} satisfies Prisma.ObstacleInclude;

// ─────────────────────────────── GET (list) ───────────────────────────────

const querySchema = z.object({
  icao: z.string().trim().min(2).max(8).optional(),
  status: z.enum(["COMPLIANT", "PENETRATING", "UNDER_MONITORING", "ILLEGAL"]).optional(),
  source: z.enum(["CERTIFIED", "SURVEY", "COMPLAINT"]).optional(),
  structureType: z.string().trim().min(1).max(80).optional(),
  q: z.string().trim().min(1).max(120).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireRole(
      "INTAKE_OFFICER",
      "AGA_REVIEWER",
      "CNS_REVIEWER",
      "PANSOPS_REVIEWER",
      "APPROVER",
      "STUDY_OFFICER",
      "ADMIN",
      "AUDITOR"
    );

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      icao: searchParams.get("icao") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      source: searchParams.get("source") ?? undefined,
      structureType: searchParams.get("structureType") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    });
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid query", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const query = parsed.data;

    // Stats reflect every filter except status, so the KPI cards stay a
    // breakdown of the current context while the status filter drills in.
    const baseWhere: Prisma.ObstacleWhereInput = {};
    if (query.icao) {
      baseWhere.airport = { icao: { equals: query.icao, mode: "insensitive" } };
    }
    if (query.source) baseWhere.source = query.source;
    if (query.structureType) {
      baseWhere.structureType = { equals: query.structureType, mode: "insensitive" };
    }
    if (query.q) {
      baseWhere.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { structureType: { contains: query.q, mode: "insensitive" } },
        { remarks: { contains: query.q, mode: "insensitive" } },
        { linkedApplication: { refNo: { contains: query.q, mode: "insensitive" } } },
      ];
    }

    const where: Prisma.ObstacleWhereInput = query.status
      ? { AND: [baseWhere, { status: query.status }] }
      : baseWhere;

    const [items, byStatus] = await Promise.all([
      prisma.obstacle.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: OBSTACLE_INCLUDE,
      }),
      prisma.obstacle.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }),
    ]);

    const count = (status: ObstacleStatus) =>
      byStatus.find((s) => s.status === status)?._count._all ?? 0;
    const total = byStatus.reduce((sum, s) => sum + s._count._all, 0);

    return Response.json({
      canManage: can(user.role, "obstacle.manage"),
      items,
      stats: {
        total,
        compliant: count("COMPLIANT"),
        penetrating: count("PENETRATING"),
        monitoring: count("UNDER_MONITORING"),
        illegal: count("ILLEGAL"),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

// ─────────────────────────────── POST (create) ───────────────────────────────

const createSchema = z
  .object({
    airportId: z.string().trim().min(1).optional(),
    icao: z.string().trim().min(2).max(8).optional(),
    name: z.string().trim().min(2, "Name is required").max(120),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    topElevationAmslM: z.number().min(-100).max(3000).optional(),
    heightAglM: z.number().min(0).max(1000).optional(),
    groundElevationM: z.number().min(-100).max(2000).optional(),
    structureType: z.string().trim().min(2).max(80),
    source: z.enum(["SURVEY", "COMPLAINT"]),
    remarks: z.string().trim().max(2000).optional(),
  })
  .refine((v) => !!v.airportId || !!v.icao, {
    message: "airportId or icao is required",
    path: ["airportId"],
  })
  .refine(
    (v) => v.topElevationAmslM != null || (v.heightAglM != null && v.groundElevationM != null),
    {
      message: "Provide topElevationAmslM, or heightAglM together with groundElevationM",
      path: ["topElevationAmslM"],
    }
  );

export async function POST(request: Request) {
  try {
    const user = await requireCapability("obstacle.manage");

    const json = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const airport = await prisma.airport.findFirst({
      where: body.airportId
        ? { id: body.airportId, active: true }
        : { icao: { equals: body.icao!, mode: "insensitive" }, active: true },
      select: { id: true, icao: true, name: true },
    });
    if (!airport) return Response.json({ error: "Airport not found" }, { status: 404 });

    const topElevationAmslM =
      body.topElevationAmslM ?? body.groundElevationM! + body.heightAglM!;

    // COMPLAINT entries start under monitoring (unverified report);
    // SURVEY entries get an immediate OLS compliance check.
    let status: ObstacleStatus = body.source === "COMPLAINT" ? "UNDER_MONITORING" : "COMPLIANT";
    let lastCheckedAt: Date | null = null;
    if (body.source === "SURVEY") {
      const loaded = await loadAirport(airport.icao);
      if (loaded) {
        const evaluation = evaluate(loaded.ols, loaded.params, {
          lat: body.lat,
          lon: body.lon,
          groundElevationM: topElevationAmslM,
          requestedHeightAglM: 0,
        });
        status = evaluation.status === "OBJECTION" ? "PENETRATING" : "COMPLIANT";
        lastCheckedAt = new Date();
      }
    }

    const obstacle = await prisma.obstacle.create({
      data: {
        airportId: airport.id,
        name: body.name,
        lat: body.lat,
        lon: body.lon,
        topElevationAmslM,
        heightAglM: body.heightAglM ?? null,
        structureType: body.structureType,
        source: body.source,
        status,
        remarks: body.remarks || null,
        lastCheckedAt,
      },
      include: OBSTACLE_INCLUDE,
    });

    await writeAudit({
      actorId: user.id,
      action: "obstacle.create",
      entity: "Obstacle",
      entityId: obstacle.id,
      after: {
        name: obstacle.name,
        airport: airport.icao,
        lat: obstacle.lat,
        lon: obstacle.lon,
        topElevationAmslM: obstacle.topElevationAmslM,
        structureType: obstacle.structureType,
        source: obstacle.source,
        status: obstacle.status,
      },
    });

    if (body.source === "COMPLAINT") {
      const officers = await prisma.user.findMany({
        where: { role: { in: ["AGA_REVIEWER", "INTAKE_OFFICER"] }, active: true },
        select: { id: true },
      });
      await notifyMany(
        officers.map((u) => u.id),
        {
          event: "OBSTACLE_FLAGGED",
          title: `Complaint logged: ${obstacle.name ?? obstacle.structureType}`,
          body: `${obstacle.structureType} near ${airport.icao} reported for monitoring — verification required.`,
          link: "/obstacles/monitoring",
        }
      );
    }

    return Response.json({ obstacle }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
