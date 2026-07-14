"use client";

// SLA countdown chip — green ok / amber ≤2 days / red breached (§13).
import * as React from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { slaState } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SlaChip({
  due,
  className,
}: {
  due: string | Date | null | undefined;
  className?: string;
}) {
  const sla = slaState(due ?? null);
  if (sla.state === "none") {
    return <span className={cn("text-xs text-muted-foreground", className)}>—</span>;
  }
  const tone =
    sla.state === "breach"
      ? "bg-destructive/10 text-destructive border-destructive/25"
      : sla.state === "warning"
        ? "bg-warning/10 text-warning border-warning/25"
        : "bg-success/10 text-success border-success/25";
  const Icon = sla.state === "breach" ? AlertTriangle : Clock;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums whitespace-nowrap",
        tone,
        className
      )}
    >
      <Icon className="size-3" aria-hidden />
      {sla.label}
    </span>
  );
}
