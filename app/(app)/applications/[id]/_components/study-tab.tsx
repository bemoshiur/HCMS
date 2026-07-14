"use client";

// Aeronautical / shielding studies — read-only; the study workspace is its own module.
import * as React from "react";
import { FlaskConical, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Stagger, StaggerItem } from "@/components/motion";
import { formatDateTime } from "@/lib/format";
import type { DetailResponse } from "../../_components/types";
import { cn } from "@/lib/utils";

export function StudyTab({ detail }: { detail: DetailResponse }) {
  const studies = detail.application.studies;

  if (studies.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No study on this case"
        description="A study is opened when a reviewer refers the case for aeronautical or shielding assessment."
      />
    );
  }

  return (
    <Stagger className="space-y-3">
      {studies.map((study) => (
        <StaggerItem key={study.id}>
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FlaskConical className="size-4 text-primary" aria-hidden />
                <h3 className="text-sm font-semibold">
                  {study.type === "AERONAUTICAL" ? "Aeronautical study" : "Shielding assessment"}
                </h3>
              </div>
              {study.outcome ? (
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    study.outcome === "PERMIT_WITH_CONDITIONS"
                      ? "bg-warning/10 text-warning border-warning/25"
                      : "bg-destructive/10 text-destructive border-destructive/25"
                  )}
                >
                  {study.outcome === "PERMIT_WITH_CONDITIONS" ? "Permit with conditions" : "Refuse"}
                </span>
              ) : (
                <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  In progress
                </span>
              )}
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Officer: {study.officer?.name ?? "Unassigned"} · Opened{" "}
              {formatDateTime(study.createdAt)}
              {study.decidedAt ? ` · Concluded ${formatDateTime(study.decidedAt)}` : ""}
            </p>

            {study.findings && (
              <p className="mt-3 rounded-md bg-muted/60 p-3 text-sm leading-relaxed">
                {study.findings}
              </p>
            )}

            {study.proposedConditions.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <ListChecks className="size-3.5" aria-hidden />
                  Proposed conditions
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {study.proposedConditions.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
