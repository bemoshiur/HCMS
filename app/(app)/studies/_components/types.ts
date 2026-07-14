// Client shapes for the /api/studies payloads (dates are ISO strings).
import type { ApplicationStatus, StudyOutcome, StudyType } from "@prisma/client";

export interface StudyEvalSummary {
  status: "CLEAR" | "OBJECTION" | "OUTSIDE";
  ptE_amslM: number | null;
  permissibleAglM: number | null;
  penetrationM: number | null;
  governingSurface: string | null;
}

export interface StudyListItem {
  id: string;
  type: StudyType;
  outcome: StudyOutcome | null;
  findings: string | null;
  proposedConditions: string[];
  officer: { id: string; name: string } | null;
  decidedAt: string | null;
  createdAt: string;
  application: {
    id: string;
    refNo: string;
    status: ApplicationStatus;
    structureType: string;
    requestedHeightAglM: number;
    slaDueAt: string | null;
    applicantOrg: { id: string; name: string };
    airport: { id: string; icao: string; name: string };
  };
  latestEval: StudyEvalSummary | null;
}

export interface StudyQueueResponse {
  open: StudyListItem[];
  completed: StudyListItem[];
  stats: { open: number; completed: number; permitRate: number };
}

export interface StudyEvaluationDto {
  id: string;
  governingSurface: string | null;
  ptE_amslM: number | null;
  permissibleAglM: number | null;
  penetrationM: number | null;
  status: "CLEAR" | "OBJECTION" | "OUTSIDE";
  surfaces: unknown;
  computedAt: string;
  engineVersion: string;
}

export interface NearbyObstacle {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  topElevationAmslM: number;
  heightAglM: number | null;
  structureType: string;
  status: string;
  distanceM: number;
}

export interface StudyWorkspaceResponse {
  study: {
    id: string;
    type: StudyType;
    findings: string | null;
    proposedConditions: string[];
    outcome: StudyOutcome | null;
    officer: { id: string; name: string } | null;
    decidedAt: string | null;
    createdAt: string;
  };
  application: {
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
    assignedOfficer: { id: string; name: string } | null;
  };
  evaluation: StudyEvaluationDto | null;
  nearbyObstacles: NearbyObstacle[];
  map: {
    center: [number, number];
    surfaces: GeoJSON.FeatureCollection | null;
    runways: GeoJSON.FeatureCollection | null;
    paramSetVersion: number | null;
  } | null;
  viewer: { role: string; canEdit: boolean };
}

export const CONDITION_SUGGESTIONS = [
  "Medium-intensity obstacle light (red, flashing) at the top",
  "Aviation orange/white paint marking per ICAO Annex 14 Ch. 6",
  "Notify CAAB 30 days before crane erection or dismantling",
  "No further vertical extension without fresh clearance",
];
