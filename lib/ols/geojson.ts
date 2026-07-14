/**
 * GeoJSON generators for the map layers:
 *  - surfaceFootprints(): capsules, rings, trapezoids and transitional bands
 *  - zoningGrid(): sampled permissible-top-elevation grid (Colour-Coded Zoning Map)
 * Pure TypeScript — consumed by both the MapLibre client and API routes.
 */

import { makeProjector, segmentFrame, type Projector, type XY } from "./geo";
import { collectSurfaceHits } from "./engine";
import type { OlsAirport, OlsParameters, OlsRunway } from "./types";

type Position = [number, number]; // [lon, lat]

export interface FootprintProperties {
  kind: string;
  name: string;
  runway: string;
  end?: string;
  baseElevationAmslM: number;
  topElevationAmslM: number;
  [key: string]: unknown;
}

export interface GeoFeature<P = Record<string, unknown>> {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: Position[][] };
  properties: P;
}

export interface GeoFeatureCollection<P = Record<string, unknown>> {
  type: "FeatureCollection";
  features: GeoFeature<P>[];
}

// ───────────────────────── Geometry primitives ─────────────────────────

/** Capsule (stadium) polygon around segment a→b at the given radius. */
function capsuleRing(a: XY, b: XY, radius: number, arcSteps = 24): XY[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // normal (left of a→b)
  const nx = -uy;
  const ny = ux;
  const ring: XY[] = [];

  // left side a→b
  ring.push({ x: a.x + nx * radius, y: a.y + ny * radius });
  ring.push({ x: b.x + nx * radius, y: b.y + ny * radius });
  // arc around b from +n to −n
  const angB = Math.atan2(ny, nx);
  for (let i = 1; i < arcSteps; i++) {
    const t = angB - (Math.PI * i) / arcSteps;
    ring.push({ x: b.x + Math.cos(t) * radius, y: b.y + Math.sin(t) * radius });
  }
  // right side b→a
  ring.push({ x: b.x - nx * radius, y: b.y - ny * radius });
  ring.push({ x: a.x - nx * radius, y: a.y - ny * radius });
  // arc around a from −n to +n
  const angA = angB + Math.PI;
  for (let i = 1; i < arcSteps; i++) {
    const t = angA - (Math.PI * i) / arcSteps;
    ring.push({ x: a.x + Math.cos(t) * radius, y: a.y + Math.sin(t) * radius });
  }
  ring.push(ring[0]);
  return ring;
}

function toPositions(projector: Projector, ring: XY[]): Position[] {
  return ring.map((p) => {
    const { lat, lon } = projector.toLatLon(p);
    return [lon, lat] as Position;
  });
}

function polygon(
  projector: Projector,
  rings: XY[][],
  properties: FootprintProperties
): GeoFeature<FootprintProperties> {
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: rings.map((r) => toPositions(projector, r)),
    },
    properties,
  };
}

// ───────────────────────── Surface footprints ─────────────────────────

export function surfaceFootprints(
  airport: OlsAirport,
  params: OlsParameters
): GeoFeatureCollection<FootprintProperties> {
  const projector = makeProjector(airport.referenceLat, airport.referenceLon);
  const features: GeoFeature<FootprintProperties>[] = [];
  const ih = params.innerHorizontal;
  const conicalOuter = ih.radiusM + params.conical.heightM / params.conical.slope;
  const transOuter =
    params.transitional.stripHalfWidthM + ih.heightM / params.transitional.slope;

  for (const rwy of airport.runways) {
    const a = projector.toXY(rwy.thresholds[0].lat, rwy.thresholds[0].lon);
    const b = projector.toXY(rwy.thresholds[1].lat, rwy.thresholds[1].lon);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    // Inner horizontal capsule
    features.push(
      polygon(projector, [capsuleRing(a, b, ih.radiusM)], {
        kind: "INNER_HORIZONTAL",
        name: `Inner Horizontal (RWY ${rwy.designator})`,
        runway: rwy.designator,
        baseElevationAmslM: airport.elevationM + ih.heightM,
        topElevationAmslM: airport.elevationM + ih.heightM,
      })
    );

    // Conical ring (outer capsule with inner hole)
    features.push(
      polygon(
        projector,
        [
          capsuleRing(a, b, conicalOuter),
          capsuleRing(a, b, ih.radiusM).slice().reverse(),
        ],
        {
          kind: "CONICAL",
          name: `Conical (RWY ${rwy.designator})`,
          runway: rwy.designator,
          baseElevationAmslM: airport.elevationM + ih.heightM,
          topElevationAmslM: airport.elevationM + ih.heightM + params.conical.heightM,
        }
      )
    );

    // Transitional bands, both sides
    for (const side of [1, -1] as const) {
      const inner = params.transitional.stripHalfWidthM * side;
      const outer = transOuter * side;
      const ring: XY[] = [
        { x: a.x + nx * inner, y: a.y + ny * inner },
        { x: b.x + nx * inner, y: b.y + ny * inner },
        { x: b.x + nx * outer, y: b.y + ny * outer },
        { x: a.x + nx * outer, y: a.y + ny * outer },
      ];
      ring.push(ring[0]);
      features.push(
        polygon(projector, [ring], {
          kind: "TRANSITIONAL",
          name: `Transitional (RWY ${rwy.designator})`,
          runway: rwy.designator,
          baseElevationAmslM: airport.elevationM,
          topElevationAmslM: airport.elevationM + ih.heightM,
        })
      );
    }

    // Per-end approach + take-off climb trapezoids
    for (const endIndex of [0, 1] as const) {
      const threshold = rwy.thresholds[endIndex];
      const origin = endIndex === 0 ? a : b;
      const ox = endIndex === 0 ? -ux : ux; // outward unit vector
      const oy = endIndex === 0 ? -uy : uy;

      // Approach trapezoid
      const ap = params.approach;
      const apInner: XY = {
        x: origin.x + ox * ap.innerEdgeDistM,
        y: origin.y + oy * ap.innerEdgeDistM,
      };
      const apOuterDist = ap.innerEdgeDistM + ap.totalLengthM;
      const apOuter: XY = {
        x: origin.x + ox * apOuterDist,
        y: origin.y + oy * apOuterDist,
      };
      const apOuterHalf = ap.innerHalfWidthM + ap.divergence * ap.totalLengthM;
      const apRing: XY[] = [
        { x: apInner.x + nx * ap.innerHalfWidthM, y: apInner.y + ny * ap.innerHalfWidthM },
        { x: apOuter.x + nx * apOuterHalf, y: apOuter.y + ny * apOuterHalf },
        { x: apOuter.x - nx * apOuterHalf, y: apOuter.y - ny * apOuterHalf },
        { x: apInner.x - nx * ap.innerHalfWidthM, y: apInner.y - ny * ap.innerHalfWidthM },
      ];
      apRing.push(apRing[0]);
      let apRise = 0;
      for (const s of ap.sections) apRise += s.lengthM * s.slope;
      features.push(
        polygon(projector, [apRing], {
          kind: "APPROACH",
          name: `Approach (RWY ${threshold.name})`,
          runway: rwy.designator,
          end: threshold.name,
          baseElevationAmslM: threshold.elevationM,
          topElevationAmslM: threshold.elevationM + apRise,
        })
      );

      // Take-off climb trapezoid
      const toc = params.takeoffClimb;
      const tocOuter: XY = {
        x: origin.x + ox * toc.totalLengthM,
        y: origin.y + oy * toc.totalLengthM,
      };
      const tocOuterHalf = toc.innerHalfWidthM + toc.divergence * toc.totalLengthM;
      const tocRing: XY[] = [
        { x: origin.x + nx * toc.innerHalfWidthM, y: origin.y + ny * toc.innerHalfWidthM },
        { x: tocOuter.x + nx * tocOuterHalf, y: tocOuter.y + ny * tocOuterHalf },
        { x: tocOuter.x - nx * tocOuterHalf, y: tocOuter.y - ny * tocOuterHalf },
        { x: origin.x - nx * toc.innerHalfWidthM, y: origin.y - ny * toc.innerHalfWidthM },
      ];
      tocRing.push(tocRing[0]);
      features.push(
        polygon(projector, [tocRing], {
          kind: "TAKEOFF_CLIMB",
          name: `Take-off Climb (RWY ${threshold.name})`,
          runway: rwy.designator,
          end: threshold.name,
          baseElevationAmslM: threshold.elevationM,
          topElevationAmslM: threshold.elevationM + toc.slope * toc.totalLengthM,
        })
      );
    }
  }

  return { type: "FeatureCollection", features };
}

/** Runway centreline as a GeoJSON LineString FeatureCollection. */
export function runwayLines(airport: OlsAirport): {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "LineString"; coordinates: Position[] };
    properties: { designator: string };
  }>;
} {
  return {
    type: "FeatureCollection",
    features: airport.runways.map((rwy) => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [rwy.thresholds[0].lon, rwy.thresholds[0].lat] as Position,
          [rwy.thresholds[1].lon, rwy.thresholds[1].lat] as Position,
        ],
      },
      properties: { designator: rwy.designator },
    })),
  };
}

// ───────────────────────── Zoning grid ─────────────────────────

export interface ZoningCellProperties {
  /** Permissible top elevation AMSL at the cell centre (null = outside OLS). */
  pte: number | null;
  /** Permissible height above the aerodrome elevation, for colour banding. */
  aboveAerodromeM: number | null;
  [key: string]: unknown;
}

/**
 * Sample permissible top elevation over a grid around the airport
 * (Colour-Coded Zoning Map). Returns square cells with a `pte` property.
 */
export function zoningGrid(
  airport: OlsAirport,
  params: OlsParameters,
  options?: { cellSizeM?: number; extentM?: number }
): GeoFeatureCollection<ZoningCellProperties> {
  const cellSizeM = options?.cellSizeM ?? 500;
  const extentM = options?.extentM ?? 16000;
  const projector = makeProjector(airport.referenceLat, airport.referenceLon);
  const features: GeoFeature<ZoningCellProperties>[] = [];

  const steps = Math.ceil((extentM * 2) / cellSizeM);
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const cx = -extentM + (i + 0.5) * cellSizeM;
      const cy = -extentM + (j + 0.5) * cellSizeM;
      const { lat, lon } = projector.toLatLon({ x: cx, y: cy });
      const { hits } = collectSurfaceHits(airport, params, lat, lon);
      if (hits.length === 0) continue; // omit cells outside the OLS

      let pte = Math.min(...hits.map((h) => h.elevationAmslM));
      if (params.cnsLimitAmslM != null) pte = Math.min(pte, params.cnsLimitAmslM);
      if (params.pansOpsLimitAmslM != null) pte = Math.min(pte, params.pansOpsLimitAmslM);

      const half = cellSizeM / 2;
      const corners: XY[] = [
        { x: cx - half, y: cy - half },
        { x: cx + half, y: cy - half },
        { x: cx + half, y: cy + half },
        { x: cx - half, y: cy + half },
      ];
      corners.push(corners[0]);
      features.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [toPositions(projector, corners)] },
        properties: {
          pte: Math.round(pte * 100) / 100,
          aboveAerodromeM: Math.round((pte - airport.elevationM) * 100) / 100,
        },
      });
    }
  }

  return { type: "FeatureCollection", features };
}
