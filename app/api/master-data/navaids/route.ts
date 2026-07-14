// Master data — navaids: POST create (CNS aid on an airport).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";

const NAVAID_TYPES = ["VOR", "DME", "ILS_GP", "ILS_LOC", "NDB"] as const;

const createSchema = z.object({
  airportId: z.string().trim().min(1),
  type: z.enum(NAVAID_TYPES),
  name: z.string().trim().max(120).optional(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  protectionRadiusM: z.number().min(0).max(20000),
  note: z.string().trim().max(2000).optional(),
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

    const airport = await prisma.airport.findUnique({
      where: { id: body.airportId },
      select: { id: true, icao: true },
    });
    if (!airport) return Response.json({ error: "Airport not found" }, { status: 404 });

    const navaid = await prisma.navaid.create({
      data: {
        airportId: airport.id,
        type: body.type,
        name: body.name || null,
        lat: body.lat,
        lon: body.lon,
        protectionRadiusM: body.protectionRadiusM,
        note: body.note || null,
      },
    });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.navaid.create",
      entity: "Navaid",
      entityId: navaid.id,
      after: {
        airport: airport.icao,
        type: navaid.type,
        name: navaid.name,
        lat: navaid.lat,
        lon: navaid.lon,
        protectionRadiusM: navaid.protectionRadiusM,
      },
    });

    return Response.json({ navaid }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
