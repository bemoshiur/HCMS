// Master data — OLS parameter sets: GET versions by airport, POST a new
// (inactive) version. Activation is a separate, confirmed action on [id].
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

// Shape of the surface parameters persisted in OlsParameterSet.json — mirrors
// lib/ols OlsParameters (kept permissive on numeric ranges; it is reference data).
const sectionSchema = z.object({
  lengthM: z.number().min(0).max(50000),
  slope: z.number().min(0).max(1),
});

const olsParametersSchema = z.object({
  framework: z.enum(["ANNEX14_CLASSIC", "OFS_OES"]),
  innerHorizontal: z.object({
    heightM: z.number().min(0).max(1000),
    radiusM: z.number().min(0).max(20000),
  }),
  conical: z.object({
    slope: z.number().min(0).max(1),
    heightM: z.number().min(0).max(1000),
  }),
  approach: z.object({
    innerEdgeDistM: z.number().min(0).max(10000),
    innerHalfWidthM: z.number().min(0).max(5000),
    divergence: z.number().min(0).max(1),
    totalLengthM: z.number().min(0).max(50000),
    sections: z.array(sectionSchema).min(1).max(6),
  }),
  takeoffClimb: z.object({
    innerHalfWidthM: z.number().min(0).max(5000),
    divergence: z.number().min(0).max(1),
    slope: z.number().min(0).max(1),
    totalLengthM: z.number().min(0).max(50000),
  }),
  transitional: z.object({
    slope: z.number().min(0).max(1),
    stripHalfWidthM: z.number().min(0).max(5000),
  }),
  cnsLimitAmslM: z.number().min(0).max(5000).nullable(),
  pansOpsLimitAmslM: z.number().min(0).max(5000).nullable(),
});

// ─────────────────────────────── GET (versions) ───────────────────────────────

const querySchema = z.object({ airportId: z.string().trim().min(1) });

export async function GET(request: Request) {
  try {
    await requireCapability("masterdata.manage");

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({ airportId: searchParams.get("airportId") ?? undefined });
    if (!parsed.success) {
      return Response.json({ error: "airportId is required" }, { status: 400 });
    }

    const items = await prisma.olsParameterSet.findMany({
      where: { airportId: parsed.data.airportId },
      orderBy: { version: "desc" },
    });

    return Response.json({ items });
  } catch (error) {
    return apiError(error);
  }
}

// ─────────────────────────────── POST (new version) ───────────────────────────────

const createSchema = z.object({
  airportId: z.string().trim().min(1),
  effectiveFrom: z.coerce.date(),
  framework: z.enum(["ANNEX14_CLASSIC", "OFS_OES"]),
  json: olsParametersSchema,
});

export async function POST(request: Request) {
  try {
    const user = await requireCapability("masterdata.manage");

    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const airport = await prisma.airport.findUnique({
      where: { id: input.airportId },
      select: { id: true, icao: true },
    });
    if (!airport) return Response.json({ error: "Airport not found" }, { status: 404 });

    // Next version = current max + 1. New versions are always created inactive.
    const latest = await prisma.olsParameterSet.findFirst({
      where: { airportId: airport.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;

    // Keep framework consistent between the column and the stored json.
    const json = { ...input.json, framework: input.framework };

    const paramSet = await prisma.olsParameterSet.create({
      data: {
        airportId: airport.id,
        version,
        effectiveFrom: input.effectiveFrom,
        framework: input.framework,
        json: json as unknown as Prisma.InputJsonValue,
        active: false,
      },
    });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.olsParams.create",
      entity: "OlsParameterSet",
      entityId: paramSet.id,
      after: {
        airport: airport.icao,
        version: paramSet.version,
        framework: paramSet.framework,
        effectiveFrom: paramSet.effectiveFrom,
        active: false,
      },
    });

    return Response.json({ paramSet }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
