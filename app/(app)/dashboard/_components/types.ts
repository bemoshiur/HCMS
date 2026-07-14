// Client-side shape of GET /api/dashboard (dates arrive as ISO strings).
import type { Role } from "@prisma/client";

export type DashboardQueue =
  | { kind: "review"; discipline: "AGA" | "CNS" | "PANSOPS"; pending: number }
  | {
      kind: "decision";
      pending: number;
      items: { id: string; refNo: string; applicantName: string; slaDueAt: string | null }[];
    }
  | { kind: "intake"; endorsed: number; scrutiny: number }
  | { kind: "study"; pending: number }
  | null;

export interface DashboardData {
  role: Role;
  kpis: {
    total: number;
    inProgress: number;
    approved: number;
    objections: number;
    certificatesIssued: number;
    avgTurnaroundDays: number;
    slaComplianceRate: number;
    avgPermissibleHeight: number;
  };
  monthly: { month: string; submitted: number; decided: number }[];
  outcomes: { name: string; value: number }[];
  byAirport: { icao: string; count: number }[];
  byStructureType: { type: string; count: number }[];
  recent: {
    id: string;
    refNo: string;
    applicantName: string;
    airportIcao: string;
    status: string;
    submittedAt: string | null;
  }[];
  myQueue: DashboardQueue;
}
