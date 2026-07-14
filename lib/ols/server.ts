// Server-side loader: DB Airport → engine OlsAirport + active parameter set.
// The single authoritative path from persisted master data into the engine.
import "server-only";
import { prisma } from "@/lib/db";
import { DEFAULT_CODE34_PARAMETERS } from "./engine";
import type { OlsAirport, OlsParameters, OlsThreshold } from "./types";

export interface LoadedAirport {
  id: string;
  icao: string;
  name: string;
  city: string;
  ols: OlsAirport;
  params: OlsParameters;
  paramSetVersion: number | null;
  navaids: Array<{ id: string; type: string; name: string | null; lat: number; lon: number; protectionRadiusM: number; note: string | null }>;
}

export async function loadAirport(icaoOrId: string): Promise<LoadedAirport | null> {
  const airport = await prisma.airport.findFirst({
    where: { OR: [{ icao: icaoOrId.toUpperCase() }, { id: icaoOrId }], active: true },
    include: {
      runways: { include: { thresholds: true } },
      navaids: true,
      olsParameterSets: { where: { active: true }, orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!airport) return null;

  const paramSet = airport.olsParameterSets[0];
  const params = (paramSet?.json as unknown as OlsParameters) ?? DEFAULT_CODE34_PARAMETERS;

  const ols: OlsAirport = {
    icao: airport.icao,
    name: airport.name,
    elevationM: airport.elevationM,
    referenceLat: airport.referenceLat,
    referenceLon: airport.referenceLon,
    runways: airport.runways
      .filter((r) => r.thresholds.length >= 2)
      .map((r) => ({
        designator: r.designator,
        thresholds: [
          toThreshold(r.thresholds[0]),
          toThreshold(r.thresholds[1]),
        ] as [OlsThreshold, OlsThreshold],
      })),
  };

  return {
    id: airport.id,
    icao: airport.icao,
    name: airport.name,
    city: airport.city,
    ols,
    params,
    paramSetVersion: paramSet?.version ?? null,
    navaids: airport.navaids.map((n) => ({
      id: n.id,
      type: n.type,
      name: n.name,
      lat: n.lat,
      lon: n.lon,
      protectionRadiusM: n.protectionRadiusM,
      note: n.note,
    })),
  };
}

function toThreshold(t: { name: string; lat: number; lon: number; elevationM: number }): OlsThreshold {
  return { name: t.name, lat: t.lat, lon: t.lon, elevationM: t.elevationM };
}
