"use client";

/**
 * Discipline review console — OLS map + automatic assessment + sibling
 * reviews + the verdict form for a single DisciplineReview.
 */
import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, MapPin, Ruler, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageTransition, FadeIn } from "@/components/motion";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { OlsMap, OlsLegend, type SiteStatus } from "@/components/map/ols-map";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/components/providers";
import { formatCoords, formatMetres, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/app/(app)/applications/_components/api";
import { VerdictForm } from "./verdict-form";
import { DISCIPLINE_LABELS, type ReviewConsoleResponse, type SurfaceHitDto } from "../../_components/types";

export function ReviewConsole({ reviewId }: { reviewId: string }) {
  const t = useT();
  const { data, isLoading, error } = useQuery<ReviewConsoleResponse>({
    queryKey: ["review", reviewId],
    queryFn: () => fetchJson<ReviewConsoleResponse>(`/api/reviews/${reviewId}`),
    retry: false,
  });

  if (isLoading) {
    return (
      <PageTransition>
        <Skeleton className="mb-6 h-9 w-72" />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Skeleton className="h-[520px] w-full" />
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </PageTransition>
    );
  }

  if (error || !data) {
    return (
      <PageTransition>
        <EmptyState
          icon={TriangleAlert}
          title="Review unavailable"
          description={error instanceof Error ? error.message : "This review could not be loaded, or it is outside your discipline."}
          action={
            <Button asChild variant="outline">
              <Link href="/review"><ArrowLeft className="size-4" aria-hidden /> Back to queue</Link>
            </Button>
          }
        />
      </PageTransition>
    );
  }

  const { review, application, evaluation, siblingReviews, map, viewer } = data;
  const evalJson = (evaluation?.surfaces ?? null) as { surfaces?: SurfaceHitDto[] } | null;
  const surfaces = evalJson?.surfaces ?? [];
  const siteStatus: SiteStatus = (evaluation?.status as SiteStatus) ?? "NONE";

  return (
    <PageTransition>
      <PageHeader
        title={`${DISCIPLINE_LABELS[review.discipline] ?? review.discipline} review`}
        description={
          <>
            {application.refNo} · {application.structureType} · {application.airport.icao}
          </>
        }
        crumbs={[
          { label: t("nav.review"), href: "/review" },
          { label: application.refNo },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link href={`/applications/${application.id}`}>Open full case</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* Map + assessment */}
        <div className="space-y-4">
          <Card className="overflow-hidden p-0">
            {map ? (
              <OlsMap
                className="h-[380px] w-full"
                center={map.center}
                surfaces={map.surfaces}
                runways={map.runways}
                navaids={map.navaids}
                site={{ lat: application.lat, lon: application.lon }}
                siteStatus={siteStatus}
                interactive
              />
            ) : (
              <div className="flex h-[380px] items-center justify-center text-sm text-muted-foreground">
                <MapPin className="mr-2 size-4" aria-hidden /> Map unavailable
              </div>
            )}
            <div className="flex items-center justify-between border-t p-2">
              <OlsLegend />
              {map?.paramSetVersion != null && (
                <span className="text-[11px] text-muted-foreground">OLS parameter set v{map.paramSetVersion}</span>
              )}
            </div>
          </Card>

          {/* Automatic assessment */}
          <Card className="p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Ruler className="size-4 text-primary" aria-hidden /> Automatic assessment
            </h3>
            {evaluation ? (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <StatusBadge status={evaluation.status} />
                  <span className="text-xs text-muted-foreground">engine {evaluation.engineVersion}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">{t("public.permissibleTopElevation")}</dt>
                  <dd className="text-right font-semibold tabular-nums">{formatMetres(evaluation.ptE_amslM)} AMSL</dd>
                  <dt className="text-muted-foreground">{t("public.permissibleHeight")}</dt>
                  <dd className="text-right tabular-nums">{formatMetres(evaluation.permissibleAglM)} AGL</dd>
                  <dt className="text-muted-foreground">{t("public.governingSurface")}</dt>
                  <dd className="text-right">{evaluation.governingSurface ?? "—"}</dd>
                  <dt className="text-muted-foreground">{t("public.penetration")}</dt>
                  <dd className={cn("text-right font-semibold tabular-nums", (evaluation.penetrationM ?? 0) > 0 && "text-destructive")}>
                    {(evaluation.penetrationM ?? 0) > 0 ? formatMetres(evaluation.penetrationM) : t("common.none")}
                  </dd>
                </dl>

                {surfaces.length > 0 && (
                  <div className="mt-4 overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Surface</TableHead>
                          <TableHead className="text-right">Limit (m AMSL)</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {surfaces.map((s, i) => (
                          <TableRow key={i} className={cn(s.penetrated && "bg-destructive/5")}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMetres(s.elevationAmslM)}</TableCell>
                            <TableCell className="text-right">
                              {s.penetrated ? (
                                <span className="text-xs font-medium text-destructive">Penetrated</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Clear</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No stored evaluation for this case.</p>
            )}
          </Card>
        </div>

        {/* Case facts + siblings + verdict */}
        <div className="space-y-4">
          <FadeIn>
            <Card className="p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="size-4 text-primary" aria-hidden /> Case
              </h3>
              <dl className="mt-3 space-y-1.5 text-sm">
                <FactRow label={t("application.applicant")} value={application.applicantOrg.name} />
                <FactRow label={t("application.authority")} value={application.authorityOrg?.name ?? "—"} />
                <FactRow label={t("common.airport")} value={`${application.airport.icao} — ${application.airport.name}`} />
                <FactRow label={t("application.structureType")} value={application.structureType} />
                <FactRow label={t("application.requestedHeight")} value={`${formatMetres(application.requestedHeightAglM)} · top ${formatMetres(application.requestedTopElevationAmslM)} AMSL`} />
                <FactRow label={t("application.coordinates")} value={formatCoords(application.lat, application.lon)} />
                <FactRow label={t("application.site")} value={application.siteAddress ?? "—"} />
                <FactRow label={t("application.submittedOn")} value={formatDate(application.submittedAt)} />
              </dl>
            </Card>
          </FadeIn>

          {/* Sibling disciplines */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold">Discipline reviews</h3>
            <ul className="mt-3 space-y-2">
              {siblingReviews.map((s) => (
                <li key={s.id} className={cn("flex items-center justify-between rounded-md border px-3 py-2 text-sm", s.id === review.id && "border-primary/40 bg-primary/5")}>
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">{s.discipline}</Badge>
                    {s.id === review.id && <span className="text-xs text-muted-foreground">(you)</span>}
                  </span>
                  {s.verdict ? (
                    <StatusBadge status={s.verdict} showDot={false} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Pending</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {/* Verdict */}
          {viewer.canDecide ? (
            <VerdictForm detail={data} />
          ) : (
            <Card className="p-4">
              <h3 className="text-sm font-semibold">Your verdict</h3>
              {review.verdict ? (
                <div className="mt-2 space-y-2">
                  <StatusBadge status={review.verdict} showDot={false} />
                  {review.overrideValueAmslM != null && (
                    <p className="text-sm">Override value: <span className="font-medium tabular-nums">{formatMetres(review.overrideValueAmslM)} AMSL</span></p>
                  )}
                  {review.remarks && <p className="text-sm text-muted-foreground">{review.remarks}</p>}
                  <p className="text-xs text-muted-foreground">Decided {formatDate(review.decidedAt)}{review.reviewer ? ` · ${review.reviewer.name}` : ""}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  This case is {application.status.replace(/_/g, " ").toLowerCase()} — it is not open for a new verdict.
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

function FactRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
