// Master data — single airport: GET full detail (runways+thresholds, navaids,
// all OLS versions), PATCH fields, DELETE (blocked if linked records exist).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

const AIRPORT_DETAIL_INCLUDE = {
  runways: {
    orderBy: { designator: "asc" },
    include: { thresholds: { orderBy: { name: "asc" } } },
  },
  navaids: { orderBy: { type: "asc" } },
  olsParameterSets: { orderBy: { version: "desc" } },
  _count: { select: { applications: true, obstacles: true } },
} satisfies Prisma.AirportInclude;

// ─────────────────────────────── GET (detail) ───────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireCapability("masterdata.manage");
    const { id } = await params;

    const airport = await prisma.airport.findUnique({
      where: { id },
      include: AIRPORT_DETAIL_INCLUDE,
    });
    if (!airport) return Response.json({ error: "Airport not found" }, { status: 404 });

    return Response.json({ airport });
  } catch (error) {
    return apiError(error);
  }
}

// ─────────────────────────────── PATCH (update) ───────────────────────────────

const patchSchema = z.object({
  iata: z.string().trim().max(4).nullable().optional(),
  name: z.string().trim().min(2).max(120).optional(),
  nameBn: z.string().trim().max(160).nullable().optional(),
  city: z.string().trim().min(1).max(80).optional(),
  elevationM: z.number().min(-100).max(5000).optional(),
  referenceLat: z.number().min(-90).max(90).optional(),
  referenceLon: z.number().min(-180).max(180).optional(),
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

    const existing = await prisma.airport.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: "Airport not found" }, { status: 404 });

    const data: Prisma.AirportUpdateInput = {};
    if (body.iata !== undefined) data.iata = body.iata ? body.iata.toUpperCase() : null;
    if (body.name !== undefined) data.name = body.name;
    if (body.nameBn !== undefined) data.nameBn = body.nameBn || null;
    if (body.city !== undefined) data.city = body.city;
    if (body.elevationM !== undefined) data.elevationM = body.elevationM;
    if (body.referenceLat !== undefined) data.referenceLat = body.referenceLat;
    if (body.referenceLon !== undefined) data.referenceLon = body.referenceLon;
    if (body.active !== undefined) data.active = body.active;

    const airport = await prisma.airport.update({ where: { id }, data });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.airport.update",
      entity: "Airport",
      entityId: airport.id,
      before: {
        iata: existing.iata,
        name: existing.name,
        nameBn: existing.nameBn,
        city: existing.city,
        elevationM: existing.elevationM,
        referenceLat: existing.referenceLat,
        referenceLon: existing.referenceLon,
        active: existing.active,
      },
      after: {
        iata: airport.iata,
        name: airport.name,
        nameBn: airport.nameBn,
        city: airport.city,
        elevationM: airport.elevationM,
        referenceLat: airport.referenceLat,
        referenceLon: airport.referenceLon,
        active: airport.active,
      },
    });

    return Response.json({ airport });
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
    const user = await requireCapability("masterdata.manage");
    const { id } = await params;

    const existing = await prisma.airport.findUnique({
      where: { id },
      include: { _count: { select: { applications: true, obstacles: true } } },
    });
    if (!existing) return Response.json({ error: "Airport not found" }, { status: 404 });

    const linked = existing._count.applications + existing._count.obstacles;
    if (linked > 0) {
      return Response.json(
        {
          error: `Cannot delete ${existing.icao}: ${existing._count.applications} application(s) and ${existing._count.obstacles} obstacle(s) reference it. Deactivate it instead.`,
        },
        { status: 409 }
      );
    }

    // Runways, thresholds, navaids and OLS parameter sets cascade on delete.
    await prisma.airport.delete({ where: { id } });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.airport.delete",
      entity: "Airport",
      entityId: id,
      before: { icao: existing.icao, name: existing.name },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
