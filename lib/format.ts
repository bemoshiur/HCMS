// Formatting helpers shared across screens.
import { format, formatDistanceToNowStrict, differenceInCalendarDays } from "date-fns";

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy");
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy, HH:mm");
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return formatDistanceToNowStrict(new Date(date), { addSuffix: true });
}

/** Decimal degrees → DMS string, e.g. 23°50′35.9″N */
export function toDMS(value: number, axis: "lat" | "lon"): string {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  const hemi = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${deg}°${String(min).padStart(2, "0")}′${sec.toFixed(1)}″${hemi}`;
}

export function formatCoords(lat: number, lon: number): string {
  return `${toDMS(lat, "lat")} ${toDMS(lon, "lon")}`;
}

export function formatMetres(value: number | null | undefined, decimals = 2): string {
  if (value == null) return "—";
  return `${value.toFixed(decimals)} m`;
}

/** SLA status for badges/countdowns. */
export function slaState(due: Date | string | null | undefined): {
  state: "none" | "ok" | "warning" | "breach";
  daysLeft: number | null;
  label: string;
} {
  if (!due) return { state: "none", daysLeft: null, label: "—" };
  const days = differenceInCalendarDays(new Date(due), new Date());
  if (days < 0) return { state: "breach", daysLeft: days, label: `${Math.abs(days)}d overdue` };
  if (days <= 2) return { state: "warning", daysLeft: days, label: `${days}d left` };
  return { state: "ok", daysLeft: days, label: `${days}d left` };
}

/** CSV export helper — quotes fields, BOM for Excel compatibility. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    "﻿" +
    [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n")
  );
}

export function downloadBlob(content: string | Blob, filename: string, type = "text/csv;charset=utf-8"): void {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
