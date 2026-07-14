/**
 * ICAO Annex 14 Obstacle Limitation Surface engine (§16 of the build brief).
 * Pure TypeScript — no React, no DB. All parameters config-driven.
 *
 * Surfaces are anchored to each runway segment (between its two thresholds):
 *  - Inner horizontal: aerodrome + h, capsule within R of the segment
 *  - Conical: 5% rise from the IH edge, R … R + H/slope
 *  - Approach (per end): trapezoid from 60 m beyond threshold, piecewise slope
 *  - Take-off climb (per end): trapezoid from the runway end, constant slope
 *  - Transitional: lateral rise from the strip edge up to the IH
 */

import { makeProjector, segmentFrame, type Projector, type XY } from "./geo";
import type {
  EvaluationInput,
  OlsAirport,
  OlsEvaluation,
  OlsParameters,
  OlsRunway,
  SurfaceHit,
} from "./types";

export const ENGINE_VERSION = "hcms-ols/1.0.0-annex14-classic";

/** ICAO Annex 14 Code 3/4 precision-capable defaults (config-driven at runtime). */
export const DEFAULT_CODE34_PARAMETERS: OlsParameters = {
  framework: "ANNEX14_CLASSIC",
  innerHorizontal: { heightM: 45, radiusM: 4000 },
  conical: { slope: 0.05, heightM: 100 },
  approach: {
    innerEdgeDistM: 60,
    innerHalfWidthM: 75,
    divergence: 0.15,
    totalLengthM: 15000,
    sections: [
      { lengthM: 3000, slope: 0.025 },
      { lengthM: 3600, slope: 0.03 },
      { lengthM: 8400, slope: 0 },
    ],
  },
  takeoffClimb: {
    innerHalfWidthM: 90,
    divergence: 0.125,
    slope: 0.02,
    totalLengthM: 15000,
  },
  transitional: { slope: 0.143, stripHalfWidthM: 150 },
  cnsLimitAmslM: null,
  pansOpsLimitAmslM: null,
};

/** Rise of the piecewise approach profile at outward distance s from the inner edge. */
export function approachRise(sections: OlsParameters["approach"]["sections"], s: number): number {
  let rise = 0;
  let remaining = s;
  for (const section of sections) {
    if (remaining <= 0) break;
    const span = Math.min(remaining, section.lengthM);
    rise += span * section.slope;
    remaining -= span;
  }
  return rise;
}

interface RunwayGeometry {
  runway: OlsRunway;
  a: XY; // threshold[0]
  b: XY; // threshold[1]
  length: number;
}

function runwayGeometry(projector: Projector, runway: OlsRunway): RunwayGeometry {
  const a = projector.toXY(runway.thresholds[0].lat, runway.thresholds[0].lon);
  const b = projector.toXY(runway.thresholds[1].lat, runway.thresholds[1].lon);
  return { runway, a, b, length: Math.hypot(b.x - a.x, b.y - a.y) };
}

/**
 * Collect every surface whose footprint contains the point, with its limit
 * elevation AMSL at that point. Evaluates all runways and both ends.
 */
export function collectSurfaceHits(
  airport: OlsAirport,
  params: OlsParameters,
  lat: number,
  lon: number
): { hits: Omit<SurfaceHit, "penetrated">[]; distanceToNearestRunwayM: number } {
  const projector = makeProjector(airport.referenceLat, airport.referenceLon);
  const p = projector.toXY(lat, lon);
  const hits: Omit<SurfaceHit, "penetrated">[] = [];
  let nearest = Infinity;

  const ih = params.innerHorizontal;
  const conicalOuterM = ih.radiusM + params.conical.heightM / params.conical.slope;
  const transOuterM =
    params.transitional.stripHalfWidthM + ih.heightM / params.transitional.slope;

  for (const rwy of airport.runways) {
    const geom = runwayGeometry(projector, rwy);
    const frame = segmentFrame(p, geom.a, geom.b);
    nearest = Math.min(nearest, frame.distToSegment);
    const d = frame.distToSegment;

    // Inner horizontal — capsule within radius of the segment
    if (d <= ih.radiusM) {
      hits.push({
        kind: "INNER_HORIZONTAL",
        name: `Inner Horizontal (RWY ${rwy.designator})`,
        runway: rwy.designator,
        elevationAmslM: airport.elevationM + ih.heightM,
        detail: { distanceM: round2(d) },
      });
    }

    // Conical — ring from IH edge outward at 5%
    if (d > ih.radiusM && d <= conicalOuterM) {
      hits.push({
        kind: "CONICAL",
        name: `Conical (RWY ${rwy.designator})`,
        runway: rwy.designator,
        elevationAmslM:
          airport.elevationM + ih.heightM + (d - ih.radiusM) * params.conical.slope,
        detail: { distanceM: round2(d) },
      });
    }

    // Transitional — beside the strip where the point projects onto the runway
    if (frame.along >= 0 && frame.along <= frame.length) {
      const lateral = Math.abs(frame.lateral);
      if (
        lateral > params.transitional.stripHalfWidthM &&
        lateral <= transOuterM
      ) {
        hits.push({
          kind: "TRANSITIONAL",
          name: `Transitional (RWY ${rwy.designator})`,
          runway: rwy.designator,
          elevationAmslM:
            airport.elevationM +
            (lateral - params.transitional.stripHalfWidthM) * params.transitional.slope,
          detail: { lateralM: round2(lateral) },
        });
      }
    }

    // Per-end surfaces: approach + take-off climb
    for (const endIndex of [0, 1] as const) {
      const threshold = rwy.thresholds[endIndex];
      // Outward frame: distance beyond this threshold along the extended
      // centreline, and lateral offset from that centreline.
      const alongOut = endIndex === 0 ? -frame.along : frame.along - frame.length;
      const lateral = Math.abs(frame.lateral);
      if (alongOut <= 0) continue; // point is not beyond this end

      // Approach — inner edge 60 m outside the threshold
      const ap = params.approach;
      const s = alongOut - ap.innerEdgeDistM;
      if (s >= 0 && s <= ap.totalLengthM) {
        const halfWidth = ap.innerHalfWidthM + ap.divergence * s;
        if (lateral <= halfWidth) {
          hits.push({
            kind: "APPROACH",
            name: `Approach (RWY ${threshold.name})`,
            runway: rwy.designator,
            end: threshold.name,
            elevationAmslM: threshold.elevationM + approachRise(ap.sections, s),
            detail: { sM: round2(s), lateralM: round2(lateral) },
          });
        }
      }

      // Take-off climb — inner edge at the runway end
      const toc = params.takeoffClimb;
      if (alongOut <= toc.totalLengthM) {
        const halfWidth = toc.innerHalfWidthM + toc.divergence * alongOut;
        if (lateral <= halfWidth) {
          hits.push({
            kind: "TAKEOFF_CLIMB",
            name: `Take-off Climb (RWY ${threshold.name})`,
            runway: rwy.designator,
            end: threshold.name,
            elevationAmslM: threshold.elevationM + toc.slope * alongOut,
            detail: { alongM: round2(alongOut), lateralM: round2(lateral) },
          });
        }
      }
    }
  }

  return { hits, distanceToNearestRunwayM: nearest };
}

/**
 * Full evaluation (§16 algorithm): governing PTE = min(AGA surfaces, CNS
 * limit, PANS-OPS limit); permissible AGL, penetration and CLEAR/OBJECTION.
 */
export function evaluate(
  airport: OlsAirport,
  params: OlsParameters,
  input: EvaluationInput
): OlsEvaluation {
  const requestedTopAmslM = input.groundElevationM + input.requestedHeightAglM;
  const { hits, distanceToNearestRunwayM } = collectSurfaceHits(
    airport,
    params,
    input.lat,
    input.lon
  );

  if (hits.length === 0) {
    return {
      status: "OUTSIDE",
      ptE_amslM: null,
      permissibleAglM: null,
      penetrationM: null,
      requestedTopAmslM,
      governingSurface: null,
      governingDomain: null,
      agaPtE_amslM: null,
      distanceToNearestRunwayM: round2(distanceToNearestRunwayM),
      surfaces: [],
      engineVersion: ENGINE_VERSION,
    };
  }

  // AGA governing = lowest surface elevation at the point
  let agaMin = Infinity;
  let governingSurface: string | null = null;
  for (const hit of hits) {
    if (hit.elevationAmslM < agaMin) {
      agaMin = hit.elevationAmslM;
      governingSurface = hit.name;
    }
  }

  // Governing PTE = min(AGA, CNS, PANS-OPS)
  let pte = agaMin;
  let governingDomain: OlsEvaluation["governingDomain"] = "AGA";
  if (params.cnsLimitAmslM != null && params.cnsLimitAmslM < pte) {
    pte = params.cnsLimitAmslM;
    governingDomain = "CNS";
    governingSurface = "CNS protection limit";
  }
  if (params.pansOpsLimitAmslM != null && params.pansOpsLimitAmslM < pte) {
    pte = params.pansOpsLimitAmslM;
    governingDomain = "PANSOPS";
    governingSurface = "PANS-OPS procedure limit";
  }

  const permissibleAglM = pte - input.groundElevationM;
  const penetrationM = requestedTopAmslM - pte;

  const surfaces: SurfaceHit[] = hits
    .map((hit) => ({
      ...hit,
      elevationAmslM: round2(hit.elevationAmslM),
      penetrated: requestedTopAmslM > hit.elevationAmslM,
    }))
    .sort((x, y) => x.elevationAmslM - y.elevationAmslM);

  return {
    status: penetrationM > 0 ? "OBJECTION" : "CLEAR",
    ptE_amslM: round2(pte),
    permissibleAglM: round2(permissibleAglM),
    penetrationM: round2(penetrationM),
    requestedTopAmslM: round2(requestedTopAmslM),
    governingSurface,
    governingDomain,
    agaPtE_amslM: round2(agaMin),
    distanceToNearestRunwayM: round2(distanceToNearestRunwayM),
    surfaces,
    engineVersion: ENGINE_VERSION,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
