/**
 * OLS engine types — pure TypeScript, no React/DB imports (portable to Python).
 * All numeric parameters come from the active OlsParameterSet (config-driven).
 */

export type Framework = "ANNEX14_CLASSIC" | "OFS_OES";

/** Piecewise approach section: length along the surface and gradient. */
export interface ApproachSection {
  lengthM: number;
  slope: number; // rise per metre (0 = horizontal section)
}

/** All surface parameters for one airport (ICAO Annex 14, Code 3/4 defaults). */
export interface OlsParameters {
  framework: Framework;
  innerHorizontal: {
    heightM: number; // above aerodrome elevation (45)
    radiusM: number; // capsule distance from runway segment (4000)
  };
  conical: {
    slope: number; // 0.05
    heightM: number; // rise above inner horizontal (100) → outer edge at radius + height/slope
  };
  approach: {
    innerEdgeDistM: number; // 60 beyond threshold
    innerHalfWidthM: number; // 75
    divergence: number; // 0.15 each side
    totalLengthM: number; // 15000
    sections: ApproachSection[]; // [{3000,0.025},{3600,0.03},{8400,0}]
  };
  takeoffClimb: {
    innerHalfWidthM: number; // 90
    divergence: number; // 0.125
    slope: number; // 0.02
    totalLengthM: number; // 15000
  };
  transitional: {
    slope: number; // 0.143
    stripHalfWidthM: number; // 150 (start of the transitional rise)
  };
  /** Per-airport CNS / PANS-OPS governing limits (AMSL); null = not limiting. */
  cnsLimitAmslM: number | null;
  pansOpsLimitAmslM: number | null;
}

export interface OlsThreshold {
  name: string; // "14"
  lat: number;
  lon: number;
  elevationM: number;
}

export interface OlsRunway {
  designator: string; // "14/32"
  thresholds: [OlsThreshold, OlsThreshold];
}

export interface OlsAirport {
  icao: string;
  name?: string;
  elevationM: number; // aerodrome elevation AMSL
  referenceLat: number;
  referenceLon: number;
  runways: OlsRunway[];
}

export interface EvaluationInput {
  lat: number;
  lon: number;
  groundElevationM: number;
  requestedHeightAglM: number;
}

export type SurfaceKind =
  | "INNER_HORIZONTAL"
  | "CONICAL"
  | "APPROACH"
  | "TAKEOFF_CLIMB"
  | "TRANSITIONAL";

export type GoverningDomain = "AGA" | "CNS" | "PANSOPS";

/** One surface whose footprint contains the evaluated point. */
export interface SurfaceHit {
  kind: SurfaceKind;
  /** Human-readable name, e.g. "Approach RWY 14" */
  name: string;
  runway: string;
  end?: string; // threshold name for per-end surfaces
  elevationAmslM: number; // surface limit elevation at the point
  penetrated: boolean; // requested top exceeds this surface
  detail?: Record<string, number>; // distances used, for the UI breakdown
}

export type EvalStatus = "CLEAR" | "OBJECTION" | "OUTSIDE";

export interface OlsEvaluation {
  status: EvalStatus;
  /** Governing permissible top elevation AMSL (min across AGA/CNS/PANS-OPS). */
  ptE_amslM: number | null;
  permissibleAglM: number | null;
  /** requestedTop − PTE; > 0 means the proposal penetrates. */
  penetrationM: number | null;
  requestedTopAmslM: number;
  governingSurface: string | null;
  governingDomain: GoverningDomain | null;
  /** AGA-only minimum before CNS/PANS-OPS limits are applied. */
  agaPtE_amslM: number | null;
  distanceToNearestRunwayM: number;
  surfaces: SurfaceHit[];
  engineVersion: string;
}
