// Master data — runways: POST create. On create the two thresholds are derived
// from the airport reference point ± length/2 along the true bearing (approximate).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { destination } from "@/lib/ols";

const APPROACH_TYPES = [
  "NON_INSTRUMENT",
  "NON_PRECISION",
  "PRECISION_I",
  "PRECISION_II",
  "PRECISION_III",
] as const;

const createSchema = z.object({
  airportId: z.string().trim().min(1),
  designator: z
    .string()
    .trim()
    .regex(/^\d{2}[LRC]?\/\d{2}[LRC]?$/i, "Use the form 14/32 or 14L/32R"),
  code: z.number().int().min(1).max(4),
  approachType: z.enum(APPROACH_TYPES),
  lengthM: z.number().min(100).max(10000),
  trueBearingDeg: z.number().min(0).max(360),
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
      select: { id: true, icao: true, referenceLat: true, referenceLon: true, elevationM: true },
    });
    if (!airport) return Response.json({ error: "Airport not found" }, { status: 404 });

    const [lowName, highName] = body.designator.split("/").map((s) => s.trim().toUpperCase());
    const half = body.lengthM / 2;
    // trueBearing runs from the lower-designator end toward the higher end, so
    // the low threshold sits length/2 behind the reference (bearing + 180) and
    // the high threshold length/2 ahead (bearing). Marked approximate.
    const low = destination(airport.referenceLat, airport.referenceLon, (body.trueBearingDeg + 180) % 360, half);
    const high = destination(airport.referenceLat, airport.referenceLon, body.trueBearingDeg, half);

    const runway = await prisma.runway.create({
      data: {
        airportId: airport.id,
        designator: body.designator.toUpperCase(),
        code: body.code,
        approachType: body.approachType,
        lengthM: body.lengthM,
        trueBearingDeg: body.trueBearingDeg,
        thresholds: {
          create: [
            { name: lowName, lat: low.lat, lon: low.lon, elevationM: airport.elevationM, approximate: true },
            { name: highName, lat: high.lat, lon: high.lon, elevationM: airport.elevationM, approximate: true },
          ],
        },
      },
      include: { thresholds: { orderBy: { name: "asc" } } },
    });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.runway.create",
      entity: "Runway",
      entityId: runway.id,
      after: {
        airport: airport.icao,
        designator: runway.designator,
        code: runway.code,
        approachType: runway.approachType,
        lengthM: runway.lengthM,
        trueBearingDeg: runway.trueBearingDeg,
      },
    });

    return Response.json({ runway }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
