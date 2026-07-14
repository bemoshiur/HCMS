"use client";

// Case detail shell: header with status + SLA + actions, workflow stepper,
// and the tabbed case record (§17 case management).
import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileX2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageTransition, FadeIn, SkeletonSwap } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { useT } from "@/components/providers";
import { fetchJson, ApiError } from "../../_components/api";
import { SlaChip } from "../../_components/sla-chip";
import type { DetailResponse } from "../../_components/types";
import { WorkflowStepper } from "./workflow-stepper";
import { CaseActions } from "./case-actions";
import { OverviewTab } from "./overview-tab";
import { EvaluationTab } from "./evaluation-tab";
import { ReviewsTab } from "./reviews-tab";
import { StudyTab } from "./study-tab";
import { DocumentsTab } from "./documents-tab";
import { TimelineTab } from "./timeline-tab";
import { CertificateTab } from "./certificate-tab";

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-9 w-96 rounded-md" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-44 w-full rounded-lg" />
        </div>
        <Skeleton className="h-[420px] w-full rounded-lg" />
      </div>
    </div>
  );
}

export function ApplicationDetail({ id }: { id: string }) {
  const t = useT();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["application", id],
    queryFn: () => fetchJson<DetailResponse>(`/api/applications/${id}`),
    retry: (failureCount, err) =>
      err instanceof ApiError && (err.status === 404 || err.status === 403)
        ? false
        : failureCount < 2,
  });

  const app = data?.application;

  return (
    <PageTransition>
      <SkeletonSwap loading={isLoading} skeleton={<DetailSkeleton />}>
        {isError || !data || !app ? (
          <EmptyState
            icon={FileX2}
            title={
              error instanceof ApiError && error.status === 403
                ? "You do not have access to this case"
                : "Case not found"
            }
            description={
              error instanceof ApiError && error.status === 403
                ? "This application belongs to a different organisation or jurisdiction."
                : "The application may have been removed, or the link is incorrect."
            }
            action={
              <Button asChild variant="outline">
                <Link href="/applications">{t("common.back")} — {t("nav.applications")}</Link>
              </Button>
            }
          />
        ) : (
          <>
            <PageHeader
              crumbs={[
                { label: t("nav.dashboard"), href: "/dashboard" },
                { label: t("nav.applications"), href: "/applications" },
                { label: app.refNo },
              ]}
              title={
                <span className="flex flex-wrap items-center gap-2.5">
                  <span className="tabular-nums">{app.refNo}</span>
                  <StatusBadge status={app.status} />
                  <SlaChip due={app.slaDueAt} />
                </span>
              }
              description={`${app.structureType} · ${app.airport.icao} — ${app.airport.name}, ${app.airport.city}`}
              actions={<CaseActions detail={data} />}
            />

            <FadeIn delay={0.05}>
              <WorkflowStepper status={app.status} className="mb-6" />
            </FadeIn>

            <Tabs defaultValue="overview" className="w-full">
              <div className="overflow-x-auto">
                <TabsList className="mb-4 h-9 w-max min-w-full justify-start sm:min-w-0">
                  <TabsTrigger value="overview">{t("nav.overview")}</TabsTrigger>
                  <TabsTrigger value="evaluation">{t("application.evaluation")}</TabsTrigger>
                  <TabsTrigger value="reviews">
                    {t("application.reviews")}
                    {app.disciplineReviews.length > 0 && (
                      <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
                        {app.disciplineReviews.filter((r) => r.verdict).length}/
                        {app.disciplineReviews.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="study">{t("application.study")}</TabsTrigger>
                  <TabsTrigger value="documents">
                    {t("application.documents")}
                    {app.documents.length > 0 && (
                      <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
                        {app.documents.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="timeline">{t("application.timeline")}</TabsTrigger>
                  <TabsTrigger value="certificate">{t("application.certificate")}</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview">
                <OverviewTab detail={data} />
              </TabsContent>
              <TabsContent value="evaluation">
                <EvaluationTab detail={data} />
              </TabsContent>
              <TabsContent value="reviews">
                <ReviewsTab detail={data} />
              </TabsContent>
              <TabsContent value="study">
                <StudyTab detail={data} />
              </TabsContent>
              <TabsContent value="documents">
                <DocumentsTab applicationId={app.id} />
              </TabsContent>
              <TabsContent value="timeline">
                <TimelineTab detail={data} />
              </TabsContent>
              <TabsContent value="certificate">
                <CertificateTab detail={data} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SkeletonSwap>
    </PageTransition>
  );
}
