"use client";

// Role-specific work queue summary with a CTA into the matching workspace.
import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  FlaskConical,
  Inbox,
  Stamp,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/motion";
import { slaState } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardQueue } from "./types";

const DISCIPLINE_LABEL: Record<string, string> = {
  AGA: "AGA",
  CNS: "CNS",
  PANSOPS: "PANS-OPS",
};

function QueueCount({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
        <CountUp value={value} />
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function SlaChip({ due }: { due: string | null }) {
  const sla = slaState(due);
  if (sla.state === "none") return null;
  return (
    <span
      className={cn(
        "shrink-0 text-xs font-medium tabular-nums",
        sla.state === "breach"
          ? "text-destructive"
          : sla.state === "warning"
            ? "text-warning"
            : "text-muted-foreground"
      )}
    >
      {sla.label}
    </span>
  );
}

export function MyQueueCard({ queue, className }: { queue: NonNullable<DashboardQueue>; className?: string }) {
  let icon: LucideIcon = Inbox;
  let body: React.ReactNode = null;
  let ctaHref = "/applications";
  let ctaLabel = "Open queue";

  switch (queue.kind) {
    case "review":
      icon = ClipboardCheck;
      ctaHref = "/review";
      ctaLabel = "Open review queue";
      body = (
        <QueueCount
          value={queue.pending}
          label={`Pending ${DISCIPLINE_LABEL[queue.discipline] ?? queue.discipline} reviews`}
        />
      );
      break;
    case "decision":
      icon = Stamp;
      ctaHref = "/applications?status=DECISION_PENDING";
      ctaLabel = "Open decision queue";
      body = (
        <div className="space-y-3">
          <QueueCount value={queue.pending} label="Cases awaiting decision" />
          {queue.items.length > 0 && (
            <ul className="divide-y rounded-md border">
              {queue.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/applications/${item.id}`}
                    className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent/50 focus-visible:outline-2"
                  >
                    <span className="font-medium text-primary">{item.refNo}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {item.applicantName}
                    </span>
                    <SlaChip due={item.slaDueAt} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
      break;
    case "intake":
      icon = Inbox;
      ctaHref = "/applications";
      ctaLabel = "Open intake queue";
      body = (
        <div className="grid grid-cols-2 gap-4">
          <QueueCount value={queue.endorsed} label="Endorsed, awaiting intake" />
          <QueueCount value={queue.scrutiny} label="In intake scrutiny" />
        </div>
      );
      break;
    case "study":
      icon = FlaskConical;
      ctaHref = "/studies";
      ctaLabel = "Open studies";
      body = <QueueCount value={queue.pending} label="Cases under aeronautical study" />;
      break;
  }

  const Icon = icon;
  return (
    <Card className={cn("gap-3 py-4", className)}>
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-primary" aria-hidden />
          My queue
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 px-4">
        <div className="flex-1">{body}</div>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href={ctaHref}>
            {ctaLabel}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
