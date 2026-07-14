// Thin fetch helpers for the applications module (TanStack Query friendly).
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

export function buildListQuery(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
