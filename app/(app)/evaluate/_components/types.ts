// Shared types + form schema + surface metadata for the OLS evaluation screen.
import { z } from "zod";
import {
  Circle,
  Cone,
  PlaneLanding,
  PlaneTakeoff,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type * as GeoJSON from "geojson";
import type { OlsEvaluation, SurfaceKind } from "@/lib/ols";

// ─────────────────────────── Form schema (RHF + Zod) ───────────────────────────

export const siteSchema = z.object({
  lat: z
    .number("Enter a latitude")
    .min(-90, "Must be between −90 and 90")
    .max(90, "Must be between −90 and 90"),
  lon: z
    .number("Enter a longitude")
    .min(-180, "Must be between −180 and 180")
    .max(180, "Must be between −180 and 180"),
  groundElevationM: z
    .number("Enter the ground elevation")
    .min(-100, "Minimum −100 m")
    .max(2000, "Maximum 2,000 m"),
  requestedHeightAglM: z
    .number("Enter the requested height")
    .min(0, "Must be 0 or more")
    .max(1000, "Maximum 1,000 m"),
});

export type SiteFormValues = z.infer<typeof siteSchema>;

// ─────────────────────────────── API contracts ───────────────────────────────

/** GET /api/airports */
export interface AirportListItem {
  id: string;
  icao: string;
  iata: string | null;
  name: string;
  nameBn: string | null;
  city: string;
  elevationM: number;
  referenceLat: number;
  referenceLon: number;
  runways: Array<{
    designator: string;
    code: number;
    approachType: string;
    lengthM: number;
  }>;
}

/** GET /api/airports/[icao]/ols */
export interface OlsPayload {
  airport: {
    icao: string;
    name: string;
    city: string;
    elevationM: number;
    referenceLat: number;
    referenceLon: number;
    paramSetVersion: number | null;
  };
  surfaces: GeoJSON.FeatureCollection;
  runways: GeoJSON.FeatureCollection;
  navaids: Array<{
    id: string;
    type: string;
    name: string | null;
    lat: number;
    lon: number;
  }>;
}

/** POST /api/evaluate */
export interface EvaluateResponse {
  airport: { icao: string; name: string };
  result: OlsEvaluation;
}

/** GET /api/applications/[id] (built by another module — used for ?app= deep links) */
export interface ApplicationPrefill {
  id: string;
  refNo: string;
  lat: number;
  lon: number;
  groundElevationM: number;
  requestedHeightAglM: number;
  airport: { icao: string };
}

// ───────────────────────────── Surface metadata ─────────────────────────────
// Colours mirror the map palette in components/map/ols-map.tsx (not exported).

export const SURFACE_META: Record<
  SurfaceKind,
  { label: string; color: string; icon: LucideIcon }
> = {
  INNER_HORIZONTAL: { label: "Inner Horizontal", color: "#1e6fb8", icon: Circle },
  CONICAL: { label: "Conical", color: "#7c3aed", icon: Cone },
  APPROACH: { label: "Approach", color: "#b3261e", icon: PlaneLanding },
  TAKEOFF_CLIMB: { label: "Take-off Climb", color: "#9a6a00", icon: PlaneTakeoff },
  TRANSITIONAL: { label: "Transitional", color: "#1a7f4b", icon: TrendingUp },
};

export const DOMAIN_LABELS: Record<string, string> = {
  AGA: "AGA — Aerodromes",
  CNS: "CNS — Communications, Navigation & Surveillance",
  PANSOPS: "PANS-OPS — Flight Procedures",
};

// ─────────────────────────────── Fetch helpers ───────────────────────────────

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function postEvaluate(
  icao: string,
  input: SiteFormValues
): Promise<EvaluateResponse> {
  const res = await fetch("/api/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ icao, ...input }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Evaluation failed (${res.status})`);
  }
  return res.json() as Promise<EvaluateResponse>;
}

export function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
