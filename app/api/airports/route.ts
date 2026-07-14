// Public: list active airports for selectors and the public site.
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/auth/guards";

export async function GET() {
  try {
    const airports = await prisma.airport.findMany({
      where: { active: true },
      orderBy: { icao: "asc" },
      select: {
        id: true,
        icao: true,
        iata: true,
        name: true,
        nameBn: true,
        city: true,
        elevationM: true,
        referenceLat: true,
        referenceLon: true,
        runways: { select: { designator: true, code: true, approachType: true, lengthM: true } },
      },
    });
    return Response.json(airports);
  } catch (error) {
    return apiError(error);
  }
}
