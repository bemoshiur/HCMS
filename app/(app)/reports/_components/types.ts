// Shared client types + fetch helpers for the Reports module.

export type Cell = string | number | null;

// ─────────────── GET /api/reports/analytics ───────────────

export interface AnalyticsResponse {
  throughput: { month: string; submitted: number; decided: number; issued: number }[];
  outcomes: { name: string; value: number }[];
  byAirport: { icao: string; total: number; cleared: number; objections: number }[];
  byAuthority: {
    name: string;
    total: number;
    endorsed: number;
    avgEndorseDays: number | null;
  }[];
  byStructureType: { type: string; count: number; avgHeight: number }[];
  turnaround: {
    avgDays: number;
    p50: number;
    p90: number;
    buckets: { range: string; count: number }[];
  };
  penetrationMap: {
    lat: number;
    lon: number;
    penetrationM: number;
    refNo: string;
    icao: string;
    applicationId: string;
  }[];
  sla: { compliant: number; breached: number; rate: number };
}

export interface AnalyticsFilters {
  icao: string; // "" = all airports
  from: string; // "" = open start
  to: string; // "" = open end
}

// ─────────────── POST /api/reports/build ───────────────

export type ReportEntity = "applications" | "certificates" | "obstacles";

export interface BuildPreview {
  headers: string[];
  rows: Cell[][];
  total: number;
  limit: number;
}

// ─────────────── GET /api/airports (+ /[icao]/ols) ───────────────

export interface AirportOption {
  id: string;
  icao: string;
  name: string;
  city: string;
  elevationM: number;
  referenceLat: number;
  referenceLon: number;
}

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
  navaids: { lat: number; lon: number; type: string; name?: string | null }[];
}

// ─────────────────────────── Helpers ───────────────────────────

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function analyticsQueryString(filters: AnalyticsFilters): string {
  const params = new URLSearchParams();
  if (filters.icao) params.set("icao", filters.icao);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// ─────────────── Report-builder column allowlists (mirror of the API) ───────────────

export interface ColumnOption {
  key: string;
  label: string;
  default: boolean;
}

export const ENTITY_COLUMNS: Record<ReportEntity, ColumnOption[]> = {
  applications: [
    { key: "refNo", label: "Reference No.", default: true },
    { key: "applicant", label: "Applicant", default: true },
    { key: "authority", label: "Approving Authority", default: false },
    { key: "airport", label: "Airport", default: true },
    { key: "structureType", label: "Structure Type", default: true },
    { key: "siteAddress", label: "Site Address", default: false },
    { key: "lat", label: "Latitude", default: false },
    { key: "lon", label: "Longitude", default: false },
    { key: "groundElevationM", label: "Ground Elevation (m AMSL)", default: false },
    { key: "requestedHeightAglM", label: "Requested Height (m AGL)", default: true },
    { key: "status", label: "Status", default: true },
    { key: "evalStatus", label: "Evaluation", default: true },
    { key: "ptE_amslM", label: "Permissible Elevation (m AMSL)", default: false },
    { key: "penetrationM", label: "Penetration (m)", default: false },
    { key: "submittedAt", label: "Submitted At", default: true },
    { key: "decidedAt", label: "Decided At", default: false },
    { key: "slaDueAt", label: "SLA Due", default: false },
  ],
  certificates: [
    { key: "hcNo", label: "HC No.", default: true },
    { key: "refNo", label: "Reference No.", default: true },
    { key: "applicant", label: "Applicant", default: true },
    { key: "airport", label: "Airport", default: true },
    { key: "ptE_amslM", label: "Permissible Elevation (m AMSL)", default: false },
    { key: "permissibleAglM", label: "Permissible Height (m AGL)", default: true },
    { key: "governingSurface", label: "Governing Surface", default: false },
    { key: "status", label: "Status", default: true },
    { key: "validFrom", label: "Valid From", default: true },
    { key: "validTo", label: "Valid To", default: true },
    { key: "issuedAt", label: "Issued At", default: false },
    { key: "signedBy", label: "Signed By", default: false },
  ],
  obstacles: [
    { key: "name", label: "Name", default: true },
    { key: "airport", label: "Airport", default: true },
    { key: "structureType", label: "Structure Type", default: true },
    { key: "lat", label: "Latitude", default: false },
    { key: "lon", label: "Longitude", default: false },
    { key: "topElevationAmslM", label: "Top Elevation (m AMSL)", default: true },
    { key: "heightAglM", label: "Height (m AGL)", default: true },
    { key: "source", label: "Source", default: false },
    { key: "status", label: "Status", default: true },
    { key: "lastCheckedAt", label: "Last Checked", default: false },
  ],
};

export const ENTITY_LABELS: Record<ReportEntity, string> = {
  applications: "Applications",
  certificates: "Certificates",
  obstacles: "Obstacles",
};

export const ENTITY_STATUSES: Record<ReportEntity, string[]> = {
  applications: [
    "DRAFT",
    "SUBMITTED",
    "ENDORSED",
    "INTAKE_SCRUTINY",
    "UNDER_REVIEW",
    "STUDY",
    "DECISION_PENDING",
    "APPROVED",
    "REJECTED",
    "RETURNED_FOR_INFO",
    "CERTIFICATE_ISSUED",
    "REVALIDATION",
    "EXPIRED",
    "REVOKED",
  ],
  certificates: ["ISSUED", "REVOKED", "EXPIRED", "SUPERSEDED"],
  obstacles: ["COMPLIANT", "PENETRATING", "UNDER_MONITORING", "ILLEGAL"],
};
