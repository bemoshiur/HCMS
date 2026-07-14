// Public obstacle register — no auth (published safeguarding data only).
// GET /api/public-register?icao=&structureType=&status=&from=&to=
// → { items: PublicObstacle[], total: number }
import { NextRequest } from "next/server";
import { z } from "zod";
import { ObstacleStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/auth/guards";

const querySchema = z.object({
  icao: z.string().min(3).max(4).optional(),
  structureType: z.string().min(1).max(120).optional(),
  status: z.nativeEnum(ObstacleStatus).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const raw = Object.fromEntries(
      ["icao", "structureType", "status", "from", "to"]
        .map((k) => [k, sp.get(k) || undefined])
        .filter(([, v]) => v !== undefined)
    );
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid query", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { icao, structureType, status, from, to } = parsed.data;

    const where: Prisma.ObstacleWhereInput = {
      ...(icao ? { airport: { icao: icao.toUpperCase() } } : {}),
      ...(structureType ? { structureType } : {}),
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.obstacle.findMany({
        where,
        orderBy: { createdAt: "desc" },
        // Public-safe fields only — no remarks, no linked case internals.
        select: {
          id: true,
          name: true,
          lat: true,
          lon: true,
          topElevationAmslM: true,
          heightAglM: true,
          structureType: true,
          status: true,
          source: true,
          lastCheckedAt: true,
          createdAt: true,
          airport: { select: { icao: true, name: true } },
        },
        take: 1000,
      }),
      prisma.obstacle.count({ where }),
    ]);

    return Response.json(
      { items, total },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch (error) {
    return apiError(error);
  }
}
