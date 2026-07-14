// Client-side shapes of the /api/reviews payloads.
// Dates travel as ISO strings — parse with new Date() where needed.
import type { ApplicationStatus, Discipline, ReviewVerdict } from "@prisma/client";

export interface UserRef {
  id: string;
  name: string;
}

export interface EvalSummary {
  status: "CLEAR" | "OBJECTION" | "OUTSIDE";
  ptE_amslM: number | null;
  permissibleAglM: number | null;
  penetrationM: number | null;
  governingSurface: string | null;
}

export interface ReviewApplicationRef {
  id: string;
  refNo: string;
  status: ApplicationStatus;
  structureType: string;
  requestedHeightAglM: number;
  slaDueAt: string | null;
  submittedAt: string | null;
  assignedDisciplines: Discipline[];
  applicantOrg: { id: string; name: string };
  airport: { id: string; icao: string; name: string };
}

export interface ReviewListItem {
  id: string;
  discipline: Discipline;
  verdict: ReviewVerdict | null;
  overrideValueAmslM: number | null;
  remarks: string | null;
  decidedAt: string | null;
  createdAt: string;
  reviewer: UserRef | null;
  application: ReviewApplicationRef;
  latestEval: EvalSummary | null;
}

export interface ReviewQueueResponse {
  discipline: Discipline;
  pending: ReviewListItem[];
  decided: ReviewListItem[];
  stats: { pending: number; decidedThisMonth: number; referredToStudy: number };
}

// ── Console (detail) ──

export interface SurfaceHitDto {
  kind: string;
  name: string;
  runway: string;
  end?: string;
  elevationAmslM: number;
  penetrated: boolean;
  detail?: Record<string, number>;
}

export interface EvaluationDto {
  id: string;
  governingSurface: string | null;
  ptE_amslM: number | null;
  permissibleAglM: number | null;
  penetrationM: number | null;
  status: "CLEAR" | "OBJECTION" | "OUTSIDE";
  surfaces: unknown; // full engine OlsEvaluation JSON
  computedAt: string;
  engineVersion: string;
}

export interface ReviewApplicationDetail {
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
  assignedDisciplines: Discipline[];
  submittedAt: string | null;
  createdAt: string;
  applicantOrg: { id: string; name: string; city: string | null; contact: string | null };
  authorityOrg: { id: string; name: string; authorityCode: string | null } | null;
  airport: {
    id: string;
    icao: string;
    name: string;
    city: string;
    elevationM: number;
    referenceLat: number;
    referenceLon: number;
  };
  assignedOfficer: UserRef | null;
}

export interface SiblingReview {
  id: string;
  discipline: Discipline;
  verdict: ReviewVerdict | null;
  overrideValueAmslM: number | null;
  remarks: string | null;
  decidedAt: string | null;
  reviewer: UserRef | null;
}

export interface ReviewConsoleResponse {
  review: {
    id: string;
    discipline: Discipline;
    verdict: ReviewVerdict | null;
    overrideValueAmslM: number | null;
    remarks: string | null;
    decidedAt: string | null;
    createdAt: string;
    reviewer: UserRef | null;
  };
  application: ReviewApplicationDetail;
  evaluation: EvaluationDto | null;
  siblingReviews: SiblingReview[];
  map: {
    center: [number, number];
    surfaces: GeoJSON.FeatureCollection | null;
    runways: GeoJSON.FeatureCollection | null;
    navaids: Array<{ lat: number; lon: number; type: string; name: string | null }>;
    paramSetVersion: number | null;
  } | null;
  viewer: { discipline: Discipline; canDecide: boolean };
}

export const DISCIPLINE_LABELS: Record<string, string> = {
  AGA: "AGA — Aerodromes & Ground Aids",
  CNS: "CNS — Communication, Navigation & Surveillance",
  PANSOPS: "PANS-OPS — Flight Procedures",
};
