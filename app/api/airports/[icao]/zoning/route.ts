// Public: colour-coded zoning grid (sampled permissible top elevations).
import { NextRequest } from "next/server";
import { loadAirport } from "@/lib/ols/server";
import { zoningGrid } from "@/lib/ols";
import { apiError } from "@/lib/auth/guards";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ icao: string }> }
) {
  try {
    const { icao } = await params;
    const airport = await loadAirport(icao);
    if (!airport) return Response.json({ error: "Airport not found" }, { status: 404 });

    const cellSizeM = Math.max(
      250,
      Math.min(2000, Number(request.nextUrl.searchParams.get("cell") ?? 500))
    );
    const grid = zoningGrid(airport.ols, airport.params, { cellSizeM, extentM: 16000 });

    const download = request.nextUrl.searchParams.get("download") === "1";
    return new Response(JSON.stringify(grid), {
      headers: {
        "Content-Type": "application/geo+json",
        "Cache-Control": "public, max-age=3600",
        ...(download
          ? { "Content-Disposition": `attachment; filename="${airport.icao}-zoning-grid.geojson"` }
          : {}),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
