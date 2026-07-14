// Shared client types for the settings module. Mirrors GET/PATCH /api/settings
// and PATCH /api/settings/profile.

export type ProfileInfo = {
  name: string;
  email: string;
  role: string;
  orgName: string | null;
};

export type SlaWorkingDays = { weekend: string[]; holidays: string[] };
export type SafeguardingRadius = { default: number };
export type FeaturesBilling = { enabled: boolean };
export type CertificateValidity = { years: number };
export type NotificationTemplate = { email: string; sms: string };
export type NotificationTemplates = Record<string, NotificationTemplate>;

export type SystemSettings = {
  "sla.workingDays"?: SlaWorkingDays;
  "safeguarding.radiusKm"?: SafeguardingRadius;
  "features.billing"?: FeaturesBilling;
  "certificate.validityYears"?: CertificateValidity;
  "notifications.templates"?: NotificationTemplates;
};

export type SettingsPayload = {
  settings: SystemSettings;
  slaPolicy: { status: string; days: number }[];
};

export type SettingKey = keyof SystemSettings;

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

export function patchSetting<K extends SettingKey>(
  key: K,
  value: NonNullable<SystemSettings[K]>
): Promise<{ setting: { key: string; value: unknown } }> {
  return fetchJson("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}

export const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export const WEEKDAY_LABELS: Record<string, string> = {
  SUN: "Sunday",
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
};

/** Notification template events surfaced for editing (with placeholder hints). */
export const TEMPLATE_EVENTS: { key: string; label: string; placeholder: string }[] = [
  { key: "APPLICATION_SUBMITTED", label: "Application submitted", placeholder: "{ref}" },
  { key: "CERTIFICATE_ISSUED", label: "Certificate issued", placeholder: "{hc}" },
];
