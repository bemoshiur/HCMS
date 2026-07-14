// Maps a notify event → lucide icon + colour tone + human label.
// Shared by the in-app list and the delivery log.
import {
  Send,
  BadgeCheck,
  Undo2,
  UserPlus,
  ClipboardCheck,
  FlaskConical,
  Gavel,
  Award,
  FileX2,
  CalendarClock,
  TriangleAlert,
  Bell,
  type LucideIcon,
} from "lucide-react";

export type EventTone = "info" | "success" | "warning" | "danger" | "primary";

interface EventMeta {
  icon: LucideIcon;
  tone: EventTone;
  label: string;
}

const EVENT_META: Record<string, EventMeta> = {
  APPLICATION_SUBMITTED: { icon: Send, tone: "info", label: "Application submitted" },
  APPLICATION_ENDORSED: { icon: BadgeCheck, tone: "success", label: "Application endorsed" },
  APPLICATION_RETURNED: { icon: Undo2, tone: "warning", label: "Application returned" },
  APPLICATION_ASSIGNED: { icon: UserPlus, tone: "info", label: "Case assigned" },
  REVIEW_COMPLETED: { icon: ClipboardCheck, tone: "success", label: "Review completed" },
  STUDY_COMPLETED: { icon: FlaskConical, tone: "info", label: "Study completed" },
  DECISION_MADE: { icon: Gavel, tone: "primary", label: "Decision made" },
  CERTIFICATE_ISSUED: { icon: Award, tone: "success", label: "Certificate issued" },
  CERTIFICATE_REVOKED: { icon: FileX2, tone: "danger", label: "Certificate revoked" },
  CERTIFICATE_EXPIRING: { icon: CalendarClock, tone: "warning", label: "Certificate expiring" },
  OBSTACLE_FLAGGED: { icon: TriangleAlert, tone: "danger", label: "Obstacle flagged" },
};

const FALLBACK: EventMeta = { icon: Bell, tone: "info", label: "Notification" };

export function eventMeta(event: string): EventMeta {
  return EVENT_META[event] ?? { ...FALLBACK, label: humanizeEvent(event) };
}

/** ENUM_LIKE_KEY → "Enum like key" for unknown events. */
export function humanizeEvent(event: string): string {
  const words = event.toLowerCase().replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Notification";
}

/** Tailwind classes for the tinted icon chip, per tone. */
export const TONE_CHIP: Record<EventTone, string> = {
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  primary: "bg-primary/10 text-primary",
};
