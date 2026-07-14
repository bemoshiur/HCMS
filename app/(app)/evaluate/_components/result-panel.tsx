"use client";

// Live evaluation result panel: animated status banner, governing surface,
// PTE (CountUp), key figures and the per-surface breakdown table.
import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash2,
  Loader2,
  MapPin,
  Ruler,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { CountUp, FadeIn, SkeletonSwap } from "@/components/motion";
import { useT } from "@/components/providers";
import { formatMetres } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OlsEvaluation } from "@/lib/ols";
import { DOMAIN_LABELS, SURFACE_META } from "./types";

const BANNER: Record<
  OlsEvaluation["status"],
  { className: string; icon: React.ElementType; textKey: string }
> = {
  CLEAR: {
    className: "border-success/30 bg-success/10 text-success",
    icon: CheckCircle2,
    textKey: "public.resultClear",
  },
  OBJECTION: {
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: XCircle,
    textKey: "public.resultObjection",
  },
  OUTSIDE: {
    className: "border-border bg-muted text-muted-foreground",
    icon: CircleSlash2,
    textKey: "public.resultOutside",
  },
};

function ResultSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/5" />
      </div>
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}

function StatRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "destructive" | "success";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-sm font-medium tabular-nums text-right transition-colors duration-300",
          tone === "destructive" && "text-destructive",
          tone === "success" && "text-success"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function ResultPanel({
  result,
  hasSite,
  evaluating,
  refreshing,
  error,
  onRetry,
}: {
  result: OlsEvaluation | null;
  hasSite: boolean;
  evaluating: boolean;
  refreshing: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const t = useT();

  if (!hasSite) {
    return (
      <EmptyState
        icon={MapPin}
        title="No site selected"
        description="Click anywhere on the map to drop the site marker, or enter coordinates in the form above."
        className="py-10"
      />
    );
  }

  if (error && !result) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={t("common.error")}
        description={error.message}
        className="py-10"
        action={
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  return (
    <SkeletonSwap loading={evaluating || !result} skeleton={<ResultSkeleton />}>
      {result && (
        <div className="space-y-4" aria-live="polite">
          {/* ── Status banner (animated colour transition) ── */}
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3.5 transition-colors duration-500",
              BANNER[result.status].className
            )}
          >
            {React.createElement(BANNER[result.status].icon, {
              className: "mt-0.5 size-5 shrink-0",
              "aria-hidden": true,
            })}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={result.status} />
                {refreshing && (
                  <span className="inline-flex items-center gap-1 text-xs opacity-80">
                    <Loader2 className="size-3 animate-spin" aria-hidden />
                    {t("common.loading")}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-medium leading-snug">
                {t(BANNER[result.status].textKey)}
              </p>
            </div>
          </div>

          {/* ── Governing PTE (big number) ── */}
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("public.permissibleTopElevation")} (AMSL)
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                {result.ptE_amslM != null ? (
                  <CountUp
                    value={result.ptE_amslM}
                    decimals={2}
                    suffix=" m"
                    className="text-3xl font-semibold tabular-nums tracking-tight text-foreground"
                  />
                ) : (
                  <span className="text-3xl font-semibold text-muted-foreground">
                    —
                  </span>
                )}
              </div>
              {result.governingSurface && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {t("public.governingSurface")}:
                  </span>
                  <span className="font-medium">{result.governingSurface}</span>
                  {result.governingDomain && (
                    <Badge
                      variant="outline"
                      title={DOMAIN_LABELS[result.governingDomain]}
                      className="text-[10px]"
                    >
                      {result.governingDomain === "PANSOPS"
                        ? "PANS-OPS"
                        : result.governingDomain}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Key figures ── */}
          <dl className="divide-y rounded-lg border bg-card px-4 py-1">
            <StatRow
              label={t("public.permissibleHeight") + " (AGL)"}
              value={formatMetres(result.permissibleAglM)}
            />
            <StatRow
              label={t("application.requestedTop")}
              value={formatMetres(result.requestedTopAmslM)}
            />
            <StatRow
              label={t("public.penetration")}
              tone={
                result.penetrationM != null && result.penetrationM > 0
                  ? "destructive"
                  : "success"
              }
              value={
                result.penetrationM == null
                  ? "—"
                  : result.penetrationM > 0
                    ? `+${formatMetres(result.penetrationM)}`
                    : t("common.none")
              }
            />
            <StatRow
              label="Distance to nearest runway"
              value={formatMetres(result.distanceToNearestRunwayM, 0)}
            />
          </dl>

          {/* ── Per-surface breakdown ── */}
          {result.surfaces.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Ruler className="size-4 text-muted-foreground" aria-hidden />
                  Per-surface breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-1">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Surface</TableHead>
                        <TableHead className="text-right">
                          Limit (m AMSL)
                        </TableHead>
                        <TableHead className="pr-4 text-right">
                          Margin (m)
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.surfaces.map((hit) => {
                        const meta = SURFACE_META[hit.kind];
                        const margin = hit.elevationAmslM - result.requestedTopAmslM;
                        const Icon = meta.icon;
                        return (
                          <TableRow
                            key={`${hit.kind}-${hit.name}`}
                            className={cn(
                              "transition-colors duration-300",
                              hit.penetrated && "bg-destructive/5 hover:bg-destructive/10"
                            )}
                          >
                            <TableCell className="pl-4">
                              <span className="flex items-center gap-2">
                                <Icon
                                  className="size-3.5 shrink-0"
                                  style={{ color: meta.color }}
                                  aria-hidden
                                />
                                <span
                                  className={cn(
                                    "truncate text-sm",
                                    hit.penetrated && "font-medium text-destructive"
                                  )}
                                >
                                  {hit.name}
                                </span>
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {hit.elevationAmslM.toFixed(2)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "pr-4 text-right tabular-nums",
                                margin < 0
                                  ? "font-medium text-destructive"
                                  : "text-success"
                              )}
                            >
                              {margin >= 0 ? "+" : ""}
                              {margin.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <FadeIn className="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground">
              The site lies outside every obstacle limitation surface of this
              aerodrome. Nearest runway is{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatMetres(result.distanceToNearestRunwayM, 0)}
              </span>{" "}
              away. No height restriction applies under this airport&apos;s OLS.
            </FadeIn>
          )}

          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("public.disclaimer")}
          </p>
        </div>
      )}
    </SkeletonSwap>
  );
}
