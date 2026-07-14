// Shared client types for the obstacle register + monitoring board.
// Mirrors /api/obstacles GET/POST/PATCH and /api/obstacles/[id]/check.
import type { OlsEvaluation } from "@/lib/ols";

export type ObstacleStatus = "COMPLIANT" | "PENETRATING" | "UNDER_MONITORING" | "ILLEGAL";
export type ObstacleSource = "CERTIFIED" | "SURVEY" | "COMPLAINT";

export type ObstacleRow = {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  topElevationAmslM: number;
  heightAglM: number | null;
  structureType: string;
  source: ObstacleSource;
  status: ObstacleStatus;
  remarks: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  airport: { id: string; icao: string; name: string };
  linkedApplication: { id: string; refNo: string } | null;
};

export type ObstaclesPayload = {
  canManage: boolean;
  items: ObstacleRow[];
  stats: {
    total: number;
    compliant: number;
    penetrating: number;
    monitoring: number;
    illegal: number;
  };
};

export type CheckResponse = {
  obstacle: ObstacleRow;
  evaluation: OlsEvaluation;
};

export type AirportOption = {
  id: string;
  icao: string;
  name: string;
  referenceLat: number;
  referenceLon: number;
};

export const OBSTACLE_STATUSES: ObstacleStatus[] = [
  "COMPLIANT",
  "PENETRATING",
  "UNDER_MONITORING",
  "ILLEGAL",
];

export const OBSTACLE_SOURCES: ObstacleSource[] = ["CERTIFIED", "SURVEY", "COMPLAINT"];

export const SOURCE_LABELS: Record<ObstacleSource, string> = {
  CERTIFIED: "Certified",
  SURVEY: "Survey",
  COMPLAINT: "Complaint",
};

export const STRUCTURE_TYPE_OPTIONS = [
  "Building",
  "Telecom Tower",
  "Mast / Antenna",
  "Chimney",
  "Water Tank",
  "Crane",
  "Power Pylon",
  "Billboard",
  "Other",
] as const;

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

/** Human summary of a compliance re-check, used in toasts. */
export function checkSummary(response: CheckResponse): string {
  const { evaluation, obstacle } = response;
  if (evaluation.status === "OUTSIDE") {
    return "Outside the obstacle limitation surfaces — recorded as compliant.";
  }
  const pte = evaluation.ptE_amslM != null ? `${evaluation.ptE_amslM.toFixed(2)} m AMSL` : "—";
  if (evaluation.penetrationM != null && evaluation.penetrationM > 0) {
    return `Penetrates ${evaluation.governingSurface ?? "the governing surface"} by ${evaluation.penetrationM.toFixed(2)} m (PTE ${pte}).${obstacle.status === "ILLEGAL" ? " Status remains Illegal." : ""}`;
  }
  const margin =
    evaluation.penetrationM != null ? Math.abs(evaluation.penetrationM).toFixed(2) : null;
  return `Below the governing PTE of ${pte}${margin ? ` with ${margin} m margin` : ""}.`;
}
