// Shared client types + helpers for the Master Data module.
// Mirrors the /api/master-data/* route contracts.
import { DEFAULT_CODE34_PARAMETERS, type OlsParameters } from "@/lib/ols";

export type { OlsParameters };

export type ApproachType =
  | "NON_INSTRUMENT"
  | "NON_PRECISION"
  | "PRECISION_I"
  | "PRECISION_II"
  | "PRECISION_III";

export type NavaidType = "VOR" | "DME" | "ILS_GP" | "ILS_LOC" | "NDB";
export type OlsFramework = "ANNEX14_CLASSIC" | "OFS_OES";

export const APPROACH_TYPES: ApproachType[] = [
  "NON_INSTRUMENT",
  "NON_PRECISION",
  "PRECISION_I",
  "PRECISION_II",
  "PRECISION_III",
];

export const NAVAID_TYPES: NavaidType[] = ["VOR", "DME", "ILS_GP", "ILS_LOC", "NDB"];

export const OLS_FRAMEWORKS: OlsFramework[] = ["ANNEX14_CLASSIC", "OFS_OES"];

export const APPROACH_TYPE_LABELS: Record<ApproachType, string> = {
  NON_INSTRUMENT: "Non-instrument",
  NON_PRECISION: "Non-precision",
  PRECISION_I: "Precision CAT I",
  PRECISION_II: "Precision CAT II",
  PRECISION_III: "Precision CAT III",
};

export const NAVAID_TYPE_LABELS: Record<NavaidType, string> = {
  VOR: "VOR",
  DME: "DME",
  ILS_GP: "ILS Glide Path",
  ILS_LOC: "ILS Localizer",
  NDB: "NDB",
};

export const FRAMEWORK_LABELS: Record<OlsFramework, string> = {
  ANNEX14_CLASSIC: "Annex 14 (classic)",
  OFS_OES: "OFS / OES",
};

// ─────────────────────────────── Row types ───────────────────────────────

export type AirportListItem = {
  id: string;
  icao: string;
  iata: string | null;
  name: string;
  nameBn: string | null;
  city: string;
  elevationM: number;
  referenceLat: number;
  referenceLon: number;
  active: boolean;
  runwayCount: number;
  navaidCount: number;
  applicationCount: number;
  obstacleCount: number;
  activeOlsVersion: number | null;
  activeOlsFramework: OlsFramework | null;
  activeOlsEffectiveFrom: string | null;
};

export type ThresholdRow = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  elevationM: number;
  approximate: boolean;
};

export type RunwayRow = {
  id: string;
  airportId: string;
  designator: string;
  code: number;
  approachType: ApproachType;
  lengthM: number;
  trueBearingDeg: number;
  thresholds: ThresholdRow[];
};

export type NavaidRow = {
  id: string;
  airportId: string;
  type: NavaidType;
  name: string | null;
  lat: number;
  lon: number;
  protectionRadiusM: number;
  note: string | null;
};

export type OlsParamSetRow = {
  id: string;
  airportId: string;
  version: number;
  effectiveFrom: string;
  framework: OlsFramework;
  json: OlsParameters;
  signedOffBy: string | null;
  active: boolean;
  createdAt: string;
};

export type AirportDetail = {
  id: string;
  icao: string;
  iata: string | null;
  name: string;
  nameBn: string | null;
  city: string;
  elevationM: number;
  referenceLat: number;
  referenceLon: number;
  active: boolean;
  runways: RunwayRow[];
  navaids: NavaidRow[];
  olsParameterSets: OlsParamSetRow[];
  _count: { applications: number; obstacles: number };
};

export type StructureTypeRow = { id: string; name: string; nameBn: string | null; active: boolean };

export type AuthorityRow = {
  id: string;
  name: string;
  nameBn: string | null;
  authorityCode: string | null;
  city: string | null;
  contact: string | null;
  active: boolean;
  userCount: number;
  applicationCount: number;
};

export type FeeRow = {
  id: string;
  structureType: string;
  heightBandM: string;
  amount: number;
  currency: string;
  active: boolean;
};

// ─────────────────────────────── Fetch helper ───────────────────────────────

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (body as { error?: string } | null)?.error ?? `Request failed (${res.status})`
    );
  }
  return body as T;
}

export function jsonBody(payload: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

/** Deep clone the reference default parameters (safe editable starting point). */
export function defaultOlsParameters(): OlsParameters {
  return structuredClone(DEFAULT_CODE34_PARAMETERS);
}
