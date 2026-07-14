"use client";

// Status semantics (§9): green = clear/approved, red = objection/rejected,
// amber = study/conditional/pending, grey = draft/outside. Used everywhere.
import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useT } from "@/components/providers";

type Tone = "green" | "red" | "amber" | "grey" | "blue";

const TONE_BY_STATUS: Record<string, Tone> = {
  // application workflow
  DRAFT: "grey",
  SUBMITTED: "blue",
  ENDORSED: "blue",
  INTAKE_SCRUTINY: "amber",
  UNDER_REVIEW: "amber",
  STUDY: "amber",
  DECISION_PENDING: "amber",
  APPROVED: "green",
  REJECTED: "red",
  RETURNED_FOR_INFO: "amber",
  CERTIFICATE_ISSUED: "green",
  REVALIDATION: "amber",
  EXPIRED: "grey",
  REVOKED: "red",
  // evaluation
  CLEAR: "green",
  OBJECTION: "red",
  OUTSIDE: "grey",
  // certificate
  ISSUED: "green",
  SUPERSEDED: "grey",
  // obstacles
  COMPLIANT: "green",
  PENETRATING: "red",
  UNDER_MONITORING: "amber",
  ILLEGAL: "red",
  // invoices
  PAID: "green",
  UNPAID: "amber",
  WAIVED: "grey",
  // reviews
  CONFIRM: "green",
  OVERRIDE: "amber",
  REFER_STUDY: "amber",
};

const TONE_CLASSES: Record<Tone, string> = {
  green: "bg-success/10 text-success border-success/25",
  red: "bg-destructive/10 text-destructive border-destructive/25",
  amber: "bg-warning/10 text-warning border-warning/25",
  grey: "bg-muted text-muted-foreground border-border",
  blue: "bg-info/10 text-info border-info/25",
};

export function StatusBadge({
  status,
  className,
  showDot = true,
}: {
  status: string;
  className?: string;
  showDot?: boolean;
}) {
  const t = useT();
  const tone = TONE_BY_STATUS[status] ?? "grey";
  const label = t(`status.${status}`);

  return (
    <motion.span
      layout
      initial={false}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors duration-300",
        TONE_CLASSES[tone],
        className
      )}
    >
      {showDot && (
        <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden />
      )}
      {label === `status.${status}` ? status : label}
    </motion.span>
  );
}

export function statusTone(status: string): Tone {
  return TONE_BY_STATUS[status] ?? "grey";
}
