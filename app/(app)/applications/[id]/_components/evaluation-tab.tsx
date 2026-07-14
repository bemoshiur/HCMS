"use client";

// Evaluation: latest OLS engine result, per-surface breakdown with penetrated
// rows highlighted, and Recompute for intake/reviewers.
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calculator, Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FadeIn } from "@/components/motion";
import { useT } from "@/components/providers";
import { formatMetres, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fetchJson } from "../../_components/api";
import type { DetailResponse, SurfaceHitDto } from "../../_components/types";

const RECOMPUTE_ROLES = [
  "INTAKE_OFFICER",
  "AGA_REVIEWER",
  "CNS_REVIEWER",
  "PANSOPS_REVIEWER",
  "STUDY_OFFICER",
  "ADMIN",
];

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "danger" | "success";
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-success"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function EvaluationTab({ detail }: { detail: DetailResponse }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { application: app, viewer } = detail;
  const latest = app.evaluationResults[0] ?? null;

  // Full engine payload is stored in the `surfaces` JSON column
  const engine = (latest?.surfaces ?? null) as {
    surfaces?: SurfaceHitDto[];
    governingDomain?: string | null;
    agaPtE_amslM?: number | null;
    distanceToNearestRunwayM?: number;
    requestedTopAmslM?: number;
  } | null;
  const surfaceHits: SurfaceHitDto[] = Array.isArray(engine?.surfaces) ? engine.surfaces : [];

  const canRecompute = RECOMPUTE_ROLES.includes(viewer.role);

  const recompute = useMutation({
    mutationFn: () =>
      fetchJson(`/api/applications/${app.id}/evaluate`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Evaluation recomputed and stored");
      queryClient.invalidateQueries({ queryKey: ["application", app.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  if (!latest) {
    return (
      <EmptyState
        icon={Calculator}
        title="No evaluation stored yet"
        description="The OLS evaluation is computed and stored when the case is accepted at intake."
        action={
          canRecompute ? (
            <Button onClick={() => recompute.mutate()} disabled={recompute.isPending}>
              {recompute.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Calculator className="size-4" aria-hidden />
              )}
              Run evaluation
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <FadeIn className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={latest.status} />
          <span className="text-xs text-muted-foreground">
            Computed {formatDateTime(latest.computedAt)} · engine {latest.engineVersion}
            {app.evaluationResults.length > 1 &&
              ` · ${app.evaluationResults.length} runs stored`}
          </span>
        </div>
        {canRecompute && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => recompute.mutate()}
            disabled={recompute.isPending}
          >
            {recompute.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            Recompute
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label={`${t("public.permissibleTopElevation")} (PTE)`}
          value={latest.ptE_amslM != null ? `${formatMetres(latest.ptE_amslM)} AMSL` : "—"}
        />
        <Metric
          label={t("public.permissibleHeight")}
          value={
            latest.permissibleAglM != null ? `${formatMetres(latest.permissibleAglM)} AGL` : "—"
          }
        />
        <Metric
          label={t("public.penetration")}
          value={
            latest.penetrationM != null && latest.penetrationM > 0
              ? `+${formatMetres(latest.penetrationM)}`
              : latest.penetrationM != null
                ? formatMetres(latest.penetrationM)
                : "—"
          }
          tone={latest.penetrationM != null && latest.penetrationM > 0 ? "danger" : "success"}
        />
        <Metric label={t("public.governingSurface")} value={latest.governingSurface ?? "—"} />
      </div>

      {engine && (
        <p className="text-xs text-muted-foreground">
          Requested top {formatMetres(app.requestedTopElevationAmslM)} AMSL
          {engine.governingDomain ? ` · governing domain ${engine.governingDomain}` : ""}
          {typeof engine.distanceToNearestRunwayM === "number"
            ? ` · ${(engine.distanceToNearestRunwayM / 1000).toFixed(2)} km to nearest runway`
            : ""}
          {" · "}
          {t("common.referenceFigure")}
        </p>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Per-surface assessment</h3>
        </div>
        {surfaceHits.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            The site lies outside all obstacle limitation surface footprints.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Surface</TableHead>
                  <TableHead>Runway</TableHead>
                  <TableHead className="text-right">Limit elevation (m AMSL)</TableHead>
                  <TableHead className="text-right">Margin (m)</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surfaceHits
                  .slice()
                  .sort((a, b) => a.elevationAmslM - b.elevationAmslM)
                  .map((hit, i) => {
                    const margin = hit.elevationAmslM - app.requestedTopElevationAmslM;
                    const governing = hit.name === latest.governingSurface;
                    return (
                      <TableRow
                        key={`${hit.name}-${i}`}
                        className={cn(
                          hit.penetrated && "bg-destructive/5 hover:bg-destructive/10",
                          governing && !hit.penetrated && "bg-primary/5"
                        )}
                      >
                        <TableCell className="font-medium">
                          {hit.name}
                          {governing && (
                            <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              Governing
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{hit.runway}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {hit.elevationAmslM.toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            margin < 0 ? "text-destructive font-medium" : "text-success"
                          )}
                        >
                          {margin >= 0 ? "+" : ""}
                          {margin.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {hit.penetrated ? (
                            <StatusBadge status="OBJECTION" />
                          ) : (
                            <StatusBadge status="CLEAR" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </FadeIn>
  );
}
