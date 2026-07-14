// Public: OLS surface footprints + runway lines + navaids for the map.
import { loadAirport } from "@/lib/ols/server";
import { surfaceFootprints, runwayLines } from "@/lib/ols";
import { apiError } from "@/lib/auth/guards";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ icao: string }> }
) {
  try {
    const { icao } = await params;
    const airport = await loadAirport(icao);
    if (!airport) return Response.json({ error: "Airport not found" }, { status: 404 });

    return Response.json(
      {
        airport: {
          icao: airport.icao,
          name: airport.name,
          city: airport.city,
          elevationM: airport.ols.elevationM,
          referenceLat: airport.ols.referenceLat,
          referenceLon: airport.ols.referenceLon,
          paramSetVersion: airport.paramSetVersion,
        },
        surfaces: surfaceFootprints(airport.ols, airport.params),
        runways: runwayLines(airport.ols),
        navaids: airport.navaids,
      },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  } catch (error) {
    return apiError(error);
  }
}
