// Fetch helper + client-side payload shapes for the authority workspace.
// Self-contained on purpose — this module only depends on shared lib/components.
import type { ApplicationStatus, Role } from "@prisma/client";
import type * as GeoJSON from "geojson";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body && typeof body.error === "string" && body.error) || `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}

// ── GET /api/authority/stats ──

export interface AuthorityStats {
  pendingEndorsement: number;
  endorsedThisMonth: number;
  returned: number;
  totalForwarded: number;
}

export interface MonthlyPoint {
  month: string;
  endorsed: number;
  returned: number;
}

export interface QueueItem {
  id: string;
  refNo: string;
  status: ApplicationStatus;
  structureType: string;
  siteAddress: string | null;
  requestedHeightAglM: number;
  lat: number;
  lon: number;
  slaDueAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  applicantOrg: { id: string; name: string };
  airport: { id: string; icao: string; name: string; city: string };
  latestEval: { status: "CLEAR" | "OBJECTION" | "OUTSIDE" } | null;
}

export interface AuthorityOverviewResponse {
  stats: AuthorityStats;
  monthly: MonthlyPoint[];
  items: QueueItem[];
}

// ── GET /api/applications/[id] (fields this workspace reads) ──

export interface EvalDto {
  id: string;
  governingSurface: string | null;
  ptE_amslM: number | null;
  permissibleAglM: number | null;
  penetrationM: number | null;
  status: "CLEAR" | "OBJECTION" | "OUTSIDE";
  computedAt: string;
  engineVersion: string;
}

export interface DocDto {
  id: string;
  type: string;
  filename: string;
  url: string;
  sizeBytes: number | null;
  mimeType: string | null;
  version: number;
  uploadedAt: string;
  uploadedBy: { id: string; name: string } | null;
}

export interface EventDto {
  id: string;
  type: string;
  note: string | null;
  internal: boolean;
  at: string;
  actor: { id: string; name: string; role: Role } | null;
}

export interface CaseDetail {
  id: string;
  refNo: string;
  status: ApplicationStatus;
  structureType: string;
  siteAddress: string | null;
  lat: number;
  lon: number;
  groundElevationM: number;
  requestedHeightAglM: number;
  requestedTopElevationAmslM: number;
  slaDueAt: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  applicantOrg: {
    id: string;
    name: string;
    contact: string | null;
    city: string | null;
    tradeLicense: string | null;
  };
  authorityOrg: {
    id: string;
    name: string;
    authorityCode: string | null;
    city: string | null;
  } | null;
  airport: {
    id: string;
    icao: string;
    name: string;
    city: string;
    elevationM: number;
    referenceLat: number;
    referenceLon: number;
  };
  createdBy: { id: string; name: string; email: string };
  evaluationResults: EvalDto[];
  documents: DocDto[];
  caseEvents: EventDto[];
}

export interface CaseDetailResponse {
  application: CaseDetail;
  map: {
    center: [number, number];
    surfaces: GeoJSON.FeatureCollection | null;
    runways: GeoJSON.FeatureCollection | null;
    paramSetVersion: number | null;
  } | null;
  viewer: { role: Role; isCaab: boolean; canIntake: boolean; canDecide: boolean };
}
