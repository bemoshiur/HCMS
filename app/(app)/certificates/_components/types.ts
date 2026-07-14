// Shared client types for the certificates module — mirror of /api/certificates GET.

export type CertificateRow = {
  id: string;
  hcNo: string;
  status: "ISSUED" | "REVOKED" | "EXPIRED" | "SUPERSEDED";
  decision: "GRANTED" | "OBJECTION";
  ptE_amslM: number;
  permissibleAglM: number;
  governingSurface: string | null;
  conditions: string[];
  validFrom: string;
  validTo: string;
  issuedAt: string;
  signedByName: string | null;
  supersededById: string | null;
  application: {
    id: string;
    refNo: string;
    structureType: string;
    applicant: string;
    airportIcao: string;
    airportName: string;
  };
};

export type AwaitingRow = {
  id: string;
  refNo: string;
  structureType: string;
  requestedHeightAglM: number;
  applicant: string;
  airportIcao: string;
  airportName: string;
  decidedAt: string;
  evaluation: {
    ptE_amslM: number | null;
    permissibleAglM: number | null;
    governingSurface: string | null;
    status: "CLEAR" | "OBJECTION" | "OUTSIDE";
  } | null;
};

export type CertificatesPayload = {
  canManage: boolean;
  stats: { issued: number; expiring90: number; revoked: number; expired: number };
  certificates: CertificateRow[];
  approvedAwaiting: AwaitingRow[];
};

export type AirportOption = { id: string; icao: string; name: string };

export type LifecycleAction = "revoke" | "revalidate" | "supersede" | "expire";

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
