// Master data — airports: GET list (with counts + active OLS version), POST create.
// ADMIN only (masterdata.manage). Every mutation is audited.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

// ─────────────────────────────── GET (list) ───────────────────────────────

export async function GET() {
  try {
    await requireCapability("masterdata.manage");

    const airports = await prisma.airport.findMany({
      orderBy: { icao: "asc" },
      include: {
        _count: { select: { runways: true, navaids: true, applications: true, obstacles: true } },
        olsParameterSets: {
          where: { active: true },
          select: { version: true, framework: true, effectiveFrom: true },
          take: 1,
        },
      },
    });

    const items = airports.map((a) => {
      const active = a.olsParameterSets[0] ?? null;
      return {
        id: a.id,
        icao: a.icao,
        iata: a.iata,
        name: a.name,
        nameBn: a.nameBn,
        city: a.city,
        elevationM: a.elevationM,
        referenceLat: a.referenceLat,
        referenceLon: a.referenceLon,
        active: a.active,
        runwayCount: a._count.runways,
        navaidCount: a._count.navaids,
        applicationCount: a._count.applications,
        obstacleCount: a._count.obstacles,
        activeOlsVersion: active?.version ?? null,
        activeOlsFramework: active?.framework ?? null,
        activeOlsEffectiveFrom: active?.effectiveFrom ?? null,
      };
    });

    return Response.json({ items });
  } catch (error) {
    return apiError(error);
  }
}

// ─────────────────────────────── POST (create) ───────────────────────────────

const createSchema = z.object({
  icao: z.string().trim().min(3, "ICAO code is required").max(4),
  iata: z.string().trim().max(4).optional(),
  name: z.string().trim().min(2, "Name is required").max(120),
  nameBn: z.string().trim().max(160).optional(),
  city: z.string().trim().min(1, "City is required").max(80),
  elevationM: z.number().min(-100).max(5000),
  referenceLat: z.number().min(-90).max(90),
  referenceLon: z.number().min(-180).max(180),
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
    const icao = body.icao.toUpperCase();
    const iata = body.iata ? body.iata.toUpperCase() : null;

    const existing = await prisma.airport.findUnique({ where: { icao }, select: { id: true } });
    if (existing) {
      return Response.json({ error: `An airport with ICAO ${icao} already exists` }, { status: 409 });
    }

    const data: Prisma.AirportCreateInput = {
      icao,
      iata,
      name: body.name,
      nameBn: body.nameBn || null,
      city: body.city,
      elevationM: body.elevationM,
      referenceLat: body.referenceLat,
      referenceLon: body.referenceLon,
      active: body.active ?? true,
    };

    const airport = await prisma.airport.create({ data });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.airport.create",
      entity: "Airport",
      entityId: airport.id,
      after: {
        icao: airport.icao,
        name: airport.name,
        city: airport.city,
        elevationM: airport.elevationM,
        referenceLat: airport.referenceLat,
        referenceLon: airport.referenceLon,
      },
    });

    return Response.json({ airport }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
