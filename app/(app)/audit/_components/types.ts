// Shared client types for the audit trail viewer. Mirrors GET /api/audit.

export type AuditActor = {
  id: string;
  name: string;
  email: string;
  role: string;
} | null;

export type AuditRow = {
  id: string;
  actorId: string | null;
  actor: AuditActor;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  at: string;
};

export type AuditFacets = {
  actions: string[];
  entities: string[];
  actors: { id: string; name: string; role: string }[];
  hasSystem: boolean;
};

export type AuditPayload = {
  items: AuditRow[];
  stats: {
    total: number;
    today: number;
    distinctActors: number;
    byAction: { action: string; count: number }[];
  };
  facets: AuditFacets;
};

export type AuditFilters = {
  action: string;
  entity: string;
  actor: string;
  from: string;
  to: string;
};

export const EMPTY_FILTERS: AuditFilters = {
  action: "all",
  entity: "all",
  actor: "all",
  from: "",
  to: "",
};

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

/** Build the querystring for both the list fetch and the CSV export. */
export function buildAuditQuery(filters: AuditFilters, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (filters.action !== "all") params.set("action", filters.action);
  if (filters.entity !== "all") params.set("entity", filters.entity);
  if (filters.actor !== "all") params.set("actor", filters.actor);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
