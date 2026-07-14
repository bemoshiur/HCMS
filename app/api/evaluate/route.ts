// Public + internal: live OLS evaluation (Zod-validated).
// The same engine also runs server-side when an application is stored.
import { NextRequest } from "next/server";
import { z } from "zod";
import { loadAirport } from "@/lib/ols/server";
import { evaluate } from "@/lib/ols";
import { apiError } from "@/lib/auth/guards";

const bodySchema = z.object({
  icao: z.string().min(3).max(4),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  groundElevationM: z.number().min(-100).max(2000),
  requestedHeightAglM: z.number().min(0).max(1000),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const airport = await loadAirport(parsed.data.icao);
    if (!airport) return Response.json({ error: "Airport not found" }, { status: 404 });

    const result = evaluate(airport.ols, airport.params, {
      lat: parsed.data.lat,
      lon: parsed.data.lon,
      groundElevationM: parsed.data.groundElevationM,
      requestedHeightAglM: parsed.data.requestedHeightAglM,
    });

    return Response.json({ airport: { icao: airport.icao, name: airport.name }, result });
  } catch (error) {
    return apiError(error);
  }
}
