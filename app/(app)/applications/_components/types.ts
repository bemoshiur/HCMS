// Client-side shapes of the /api/applications payloads.
// Dates travel as ISO strings — parse with new Date() where needed.
import type { ApplicationStatus, Discipline, Role } from "@prisma/client";

export interface OrgRef {
  id: string;
  name: string;
}

export interface UserRef {
  id: string;
  name: string;
}

export interface LatestEval {
  status: "CLEAR" | "OBJECTION" | "OUTSIDE";
  ptE_amslM: number | null;
  permissibleAglM: number | null;
  penetrationM: number | null;
  governingSurface: string | null;
}

export interface ApplicationListItem {
  id: string;
  refNo: string;
  status: ApplicationStatus;
  structureType: string;
  requestedHeightAglM: number;
  lat: number;
  lon: number;
  slaDueAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  assignedDisciplines: Discipline[];
  applicantOrg: OrgRef;
  authorityOrg: OrgRef | null;
  airport: { id: string; icao: string; name: string };
  assignedOfficer: UserRef | null;
  latestEval: LatestEval | null;
  certificate: { hcNo: string; status: string } | null;
}

export interface ListStats {
  inProgress: number;
  slaBreached: number;
  objections: number;
  certificatesIssued: number;
}

export interface ListResponse {
  items: ApplicationListItem[];
  stats: ListStats | null;
  meta: { count: number; cap: number };
}

// ── Detail ──

export interface EvaluationResultDto {
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

export interface SurfaceHitDto {
  kind: string;
  name: string;
  runway: string;
  end?: string;
  elevationAmslM: number;
  penetrated: boolean;
  detail?: Record<string, number>;
}

export interface DisciplineReviewDto {
  id: string;
  discipline: Discipline;
  verdict: "CONFIRM" | "OVERRIDE" | "REFER_STUDY" | null;
  overrideValueAmslM: number | null;
  remarks: string | null;
  decidedAt: string | null;
  createdAt: string;
  reviewer: UserRef | null;
}

export interface StudyDto {
  id: string;
  type: "AERONAUTICAL" | "SHIELDING";
  findings: string | null;
  proposedConditions: string[];
  outcome: "PERMIT_WITH_CONDITIONS" | "REFUSE" | null;
  decidedAt: string | null;
  createdAt: string;
  officer: UserRef | null;
}

export interface CertificateDto {
  id: string;
  hcNo: string;
  decision: "GRANTED" | "OBJECTION";
  status: "ISSUED" | "REVOKED" | "EXPIRED" | "SUPERSEDED";
  ptE_amslM: number;
  permissibleAglM: number;
  governingSurface: string | null;
  conditions: string[];
  validFrom: string;
  validTo: string;
  issuedAt: string;
}

export interface DocumentDto {
  id: string;
  type: string;
  filename: string;
  url: string;
  sizeBytes: number | null;
  mimeType: string | null;
  version: number;
  uploadedAt: string;
  uploadedBy: UserRef | null;
}

export interface CaseEventDto {
  id: string;
  type: string;
  note: string | null;
  internal: boolean;
  at: string;
  actor: (UserRef & { role: Role }) | null;
}

export interface ApplicationDetail {
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
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  applicantOrg: OrgRef & { contact: string | null; city: string | null; tradeLicense: string | null };
  authorityOrg: (OrgRef & { authorityCode: string | null; city: string | null }) | null;
  airport: {
    id: string;
    icao: string;
    name: string;
    city: string;
    elevationM: number;
    referenceLat: number;
    referenceLon: number;
  };
  createdBy: UserRef & { email: string };
  assignedOfficer: (UserRef & { email: string }) | null;
  evaluationResults: EvaluationResultDto[];
  disciplineReviews: DisciplineReviewDto[];
  studies: StudyDto[];
  certificates: CertificateDto[];
  documents: DocumentDto[];
  caseEvents: CaseEventDto[];
}

export interface DetailResponse {
  application: ApplicationDetail;
  map: {
    center: [number, number];
    surfaces: GeoJSON.FeatureCollection | null;
    runways: GeoJSON.FeatureCollection | null;
    paramSetVersion: number | null;
  } | null;
  assignableOfficers: Array<{ id: string; name: string; role: string }>;
  viewer: { role: Role; isCaab: boolean; canIntake: boolean; canDecide: boolean };
}

export interface AirportOption {
  id: string;
  icao: string;
  name: string;
  city: string;
}
