// Applicant portal — shared client types, constants and fetch helpers.
// Dates travel as ISO strings; parse with new Date() where needed.
import type { ApplicationStatus } from "@prisma/client";

// ─────────────────────────────── Constants ───────────────────────────────

/** Mirrors prisma/seed-data.ts SEED_STRUCTURE_TYPES (11 real structure types). */
export const STRUCTURE_TYPES = [
  "Residential Building",
  "Commercial Building",
  "Mixed-use Building",
  "Telecom Tower (Greenfield)",
  "Telecom Tower (Rooftop)",
  "Industrial Chimney",
  "Water Tank (Overhead)",
  "Transmission Line Tower",
  "Communication Mast",
  "Construction Crane (Temporary)",
  "Silo / Storage Structure",
] as const;

export type PortalDocType = "OWNERSHIP" | "SITE_PLAN" | "ELEVATION_CERT" | "MOUZA_MAP" | "OTHER";

export const REQUIRED_DOC_TYPES: PortalDocType[] = [
  "OWNERSHIP",
  "SITE_PLAN",
  "ELEVATION_CERT",
  "MOUZA_MAP",
];

export const DOC_TYPE_META: Record<PortalDocType, { label: string; hint: string }> = {
  OWNERSHIP: {
    label: "Ownership Document",
    hint: "Title deed / lease agreement establishing ownership of the plot",
  },
  SITE_PLAN: {
    label: "Site Plan",
    hint: "Approved layout plan showing the structure footprint",
  },
  ELEVATION_CERT: {
    label: "Ground Elevation Certificate",
    hint: "Surveyed ground elevation (m AMSL) from a licensed surveyor",
  },
  MOUZA_MAP: {
    label: "Mouza Map",
    hint: "Mouza / cadastral map identifying the plot",
  },
  OTHER: {
    label: "Other Supporting Documents",
    hint: "Optional — NOC, structural drawings, additional papers",
  },
};

export const ACCEPTED_MIME = ["application/pdf", "image/png", "image/jpeg"];
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

// ─────────────────────────────── API shapes ───────────────────────────────

export interface AirportOption {
  id: string;
  icao: string;
  iata: string | null;
  name: string;
  city: string;
  elevationM: number;
  referenceLat: number;
  referenceLon: number;
}

export interface AuthorityOption {
  id: string;
  name: string;
  authorityCode: string | null;
  city: string | null;
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
  navaids: Array<{ id: string; type: string; name: string | null; lat: number; lon: number }>;
}

export interface LiveEvalResult {
  status: "CLEAR" | "OBJECTION" | "OUTSIDE";
  ptE_amslM: number | null;
  permissibleAglM: number | null;
  penetrationM: number | null;
  requestedTopAmslM: number;
  governingSurface: string | null;
  governingDomain: string | null;
  distanceToNearestRunwayM: number;
  engineVersion: string;
}

export interface EvaluateResponse {
  airport: { icao: string; name: string };
  result: LiveEvalResult;
}

export interface UploadedDoc {
  id: string;
  type: PortalDocType;
  filename: string;
  url: string;
  sizeBytes: number | null;
  mimeType: string | null;
  version: number;
  uploadedAt: string;
}

/** Row shape from GET /api/applications (role-scoped for the applicant). */
export interface PortalListItem {
  id: string;
  refNo: string;
  status: ApplicationStatus;
  structureType: string;
  requestedHeightAglM: number;
  slaDueAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  applicantOrg: { id: string; name: string };
  authorityOrg: { id: string; name: string } | null;
  airport: { id: string; icao: string; name: string };
  latestEval: {
    status: "CLEAR" | "OBJECTION" | "OUTSIDE";
    permissibleAglM: number | null;
  } | null;
  certificate: { hcNo: string; status: string } | null;
}

export interface PortalListResponse {
  items: PortalListItem[];
  stats: {
    inProgress: number;
    slaBreached: number;
    objections: number;
    certificatesIssued: number;
  } | null;
}

// ─────────────────────────────── Fetch helpers ───────────────────────────────

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
    headers:
      init?.body instanceof FormData
        ? init?.headers
        : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

/** Upload with real progress via XHR (fetch cannot report upload progress). */
export function uploadDocument(options: {
  file: File;
  type: PortalDocType;
  applicationId: string;
  onProgress?: (percent: number) => void;
}): Promise<UploadedDoc> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", options.file);
    form.append("type", options.type);
    form.append("applicationId", options.applicationId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/portal/documents");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onerror = () => reject(new ApiError("Network error during upload", 0));
    xhr.onload = () => {
      const body = xhr.response as { document?: UploadedDoc; error?: string } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.document) {
        resolve(body.document);
      } else {
        reject(new ApiError(body?.error ?? `Upload failed (${xhr.status})`, xhr.status));
      }
    };
    xhr.send(form);
  });
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
