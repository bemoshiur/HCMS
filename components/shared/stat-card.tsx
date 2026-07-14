"use client";

// KPI card with animated count-up (§6 "data delight, restrained").
import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CountUp, StaggerItem } from "@/components/motion";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  suffix = "",
  decimals = 0,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: number;
  icon?: LucideIcon;
  suffix?: string;
  decimals?: number;
  hint?: React.ReactNode;
  tone?: "default" | "success" | "danger" | "warning" | "info";
  className?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-destructive"
        : tone === "warning"
          ? "text-warning"
          : tone === "info"
            ? "text-info"
            : "text-primary";

  return (
    <StaggerItem>
      <Card className={cn("p-4 gap-1", className)}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground truncate">{label}</p>
          {Icon && <Icon className={cn("size-5 shrink-0", toneClass)} aria-hidden />}
        </div>
        <p className={cn("text-2xl font-semibold tabular-nums tracking-tight", toneClass)}>
          <CountUp value={value} decimals={decimals} suffix={suffix} />
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </Card>
    </StaggerItem>
  );
}
