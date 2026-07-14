"use client";

// Discipline reviews — read-only here; the review console is its own module.
import * as React from "react";
import { ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Stagger, StaggerItem } from "@/components/motion";
import { formatDateTime, formatMetres } from "@/lib/format";
import type { DetailResponse } from "../../_components/types";

const DISCIPLINE_LABELS: Record<string, string> = {
  AGA: "AGA — Aerodromes & Ground Aids",
  CNS: "CNS — Communication, Navigation & Surveillance",
  PANSOPS: "PANS-OPS — Flight Procedures",
};

export function ReviewsTab({ detail }: { detail: DetailResponse }) {
  const reviews = detail.application.disciplineReviews;

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No discipline reviews yet"
        description="Review rows are created when the case is accepted at intake and assigned to disciplines."
      />
    );
  }

  return (
    <Stagger className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {reviews.map((review) => (
        <StaggerItem key={review.id}>
          <Card className="h-full p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{review.discipline}</p>
                <p className="text-xs text-muted-foreground">
                  {DISCIPLINE_LABELS[review.discipline] ?? review.discipline}
                </p>
              </div>
              {review.verdict ? (
                <StatusBadge status={review.verdict} />
              ) : (
                <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Pending
                </span>
              )}
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Reviewer</dt>
                <dd className="font-medium">{review.reviewer?.name ?? "Unassigned"}</dd>
              </div>
              {review.overrideValueAmslM != null && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Override PTE</dt>
                  <dd className="font-medium tabular-nums">
                    {formatMetres(review.overrideValueAmslM)} AMSL
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Decided</dt>
                <dd>{review.decidedAt ? formatDateTime(review.decidedAt) : "—"}</dd>
              </div>
            </dl>
            {review.remarks && (
              <p className="mt-3 rounded-md bg-muted/60 p-2.5 text-sm text-foreground/90">
                {review.remarks}
              </p>
            )}
          </Card>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
