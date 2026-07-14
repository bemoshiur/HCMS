"use client";

// Authority-facing case detail (§17): status hero with animated colour
// transition + endorse/return actions, applicant & site cards, mini OLS map,
// indicative evaluation, document downloads and the external timeline.
import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Calculator,
  CircleDot,
  Download,
  FileClock,
  FileText,
  FileX2,
  Files,
  Inbox,
  Landmark,
  MapPin,
  MessageSquare,
  RotateCcw,
  Send,
  UserRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PageTransition,
  FadeIn,
  SkeletonSwap,
  Stagger,
  StaggerItem,
  AnimatePresence,
  motion,
} from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, statusTone } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { OlsMap, OlsLegend } from "@/components/map/ols-map";
import { useT } from "@/components/providers";
import {
  formatCoords,
  formatDate,
  formatDateTime,
  formatMetres,
  slaState,
  timeAgo,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { WaitingChip } from "@/app/(app)/authority/_components/authority-workspace";
import {
  fetchJson,
  ApiError,
  type CaseDetailResponse,
  type CaseDetail,
  type EventDto,
} from "@/app/(app)/authority/_components/api";
import { AuthorityActions } from "./authority-actions";

// ─────────────────────────── Small pieces ───────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-52 w-full rounded-lg" />
          <Skeleton className="h-36 w-full rounded-lg" />
        </div>
        <Skeleton className="h-[460px] w-full rounded-lg" />
      </div>
    </div>
  );
}

// ─────────────────────────── Status hero ───────────────────────────

const HERO_TONE: Record<string, string> = {
  green: "border-success/30 bg-success/5",
  red: "border-destructive/30 bg-destructive/5",
  amber: "border-warning/30 bg-warning/5",
  blue: "border-info/30 bg-info/5",
  grey: "border-border bg-muted/30",
};

const HERO_ICON_TONE: Record<string, string> = {
  green: "bg-success/10 text-success",
  red: "bg-destructive/10 text-destructive",
  amber: "bg-warning/10 text-warning",
  blue: "bg-info/10 text-info",
  grey: "bg-muted text-muted-foreground",
};

function heroContent(
  app: CaseDetail,
  t: (k: string) => string
): { icon: LucideIcon; heading: string; sub: string } {
  switch (app.status) {
    case "SUBMITTED":
      return {
        icon: Inbox,
        heading: "Awaiting your endorsement",
        sub: `Submitted ${timeAgo(app.submittedAt)} — endorse and forward to CAAB, or return to the applicant with remarks.`,
      };
    case "ENDORSED":
      return {
        icon: Send,
        heading: "Endorsed & forwarded to CAAB",
        sub: "This case is now with CAAB intake for scrutiny.",
      };
    case "RETURNED_FOR_INFO":
      return {
        icon: RotateCcw,
        heading: "Returned to applicant",
        sub: "Waiting for the applicant to revise and resubmit.",
      };
    case "APPROVED":
      return {
        icon: BadgeCheck,
        heading: "Approved by CAAB",
        sub: "The height clearance certificate will follow.",
      };
    case "CERTIFICATE_ISSUED":
      return {
        icon: BadgeCheck,
        heading: "Certificate issued",
        sub: "CAAB has issued the height clearance certificate for this structure.",
      };
    case "REJECTED":
    case "REVOKED":
      return {
        icon: XCircle,
        heading: `${t(`status.${app.status}`)} by CAAB`,
        sub: "See the timeline below for the recorded reasons.",
      };
    default:
      return {
        icon: CircleDot,
        heading: `With CAAB — ${t(`status.${app.status}`)}`,
        sub: "The case is progressing through the CAAB workflow.",
      };
  }
}

function StatusHero({ detail }: { detail: CaseDetailResponse }) {
  const t = useT();
  const app = detail.application;
  const tone = statusTone(app.status);
  const { icon: Icon, heading, sub } = heroContent(app, t);
  const sla = app.status === "SUBMITTED" ? slaState(app.slaDueAt) : null;

  return (
    <section
      aria-live="polite"
      className={cn(
        "mb-6 rounded-lg border p-4 transition-colors duration-500 sm:p-5",
        HERO_TONE[tone] ?? HERO_TONE.grey
      )}
    >
      <div className="flex flex-wrap items-center gap-4">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-500",
            HERO_ICON_TONE[tone] ?? HERO_ICON_TONE.grey
          )}
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={app.status}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="min-w-0 flex-1"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{heading}</h2>
              {app.status === "SUBMITTED" && <WaitingChip submittedAt={app.submittedAt} />}
              {sla && sla.state !== "none" && (
                <span className="text-xs text-muted-foreground">
                  {t("application.slaDue")}: {formatDate(app.slaDueAt)} ({sla.label})
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>
          </motion.div>
        </AnimatePresence>
        <div className="shrink-0">
          <AuthorityActions detail={detail} />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────── Documents card ───────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  OWNERSHIP: "Ownership",
  SITE_PLAN: "Site plan",
  ELEVATION_CERT: "Elevation certificate",
  MOUZA_MAP: "Mouza map",
  OTHER: "Other",
};

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentsCard({ app }: { app: CaseDetail }) {
  const t = useT();
  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center gap-2">
        <Files className="size-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">{t("application.documents")}</h3>
        {app.documents.length > 0 && (
          <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
            {app.documents.length}
          </span>
        )}
      </div>
      {app.documents.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          No documents uploaded by the applicant yet.
        </p>
      ) : (
        <ul className="divide-y">
          {app.documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 py-2">
              <FileText className="size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={doc.filename}>
                  {doc.filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {DOC_TYPE_LABELS[doc.type] ?? doc.type} · v{doc.version} ·{" "}
                  {formatSize(doc.sizeBytes)} · {formatDate(doc.uploadedAt)}
                </p>
              </div>
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                aria-label={`${t("common.download")} ${doc.filename}`}
              >
                <a href={doc.url} target="_blank" rel="noopener noreferrer" download>
                  <Download className="size-4" aria-hidden />
                </a>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─────────────────────────── Timeline card ───────────────────────────

function eventMeta(type: string, t: (k: string) => string): { icon: LucideIcon; label: string; tone: string } {
  const statusLabel = t(`status.${type}`);
  if (statusLabel !== `status.${type}`) {
    const tone =
      type === "APPROVED" || type === "CERTIFICATE_ISSUED"
        ? "bg-success/10 text-success"
        : type === "REJECTED" || type === "REVOKED"
          ? "bg-destructive/10 text-destructive"
          : type === "RETURNED_FOR_INFO" || type === "STUDY"
            ? "bg-warning/10 text-warning"
            : "bg-info/10 text-info";
    const icon =
      type === "APPROVED" || type === "CERTIFICATE_ISSUED"
        ? BadgeCheck
        : type === "REJECTED" || type === "REVOKED"
          ? XCircle
          : type === "RETURNED_FOR_INFO"
            ? RotateCcw
            : type === "ENDORSED"
              ? Send
              : CircleDot;
    return { icon, label: statusLabel, tone };
  }
  if (type === "MESSAGE")
    return { icon: MessageSquare, label: "Message", tone: "bg-info/10 text-info" };
  if (type === "CREATED")
    return { icon: FileClock, label: "Created", tone: "bg-muted text-muted-foreground" };
  return {
    icon: CircleDot,
    label: type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " "),
    tone: "bg-muted text-muted-foreground",
  };
}

function TimelineCard({ events }: { events: EventDto[] }) {
  const t = useT();
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileClock className="size-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">{t("application.timeline")}</h3>
      </div>
      {events.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Case activity will appear here.</p>
      ) : (
        <Stagger className="relative">
          {events.map((event, i) => {
            const meta = eventMeta(event.type, t);
            const Icon = meta.icon;
            const isLast = i === events.length - 1;
            return (
              <StaggerItem key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                {!isLast && (
                  <span
                    className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px bg-border"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "z-10 flex size-7 shrink-0 items-center justify-center rounded-full",
                    meta.tone
                  )}
                  aria-hidden
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-semibold">{meta.label}</span>
                    <span
                      className="ml-auto whitespace-nowrap text-xs text-muted-foreground"
                      title={formatDateTime(event.at)}
                    >
                      {timeAgo(event.at)}
                    </span>
                  </div>
                  {event.note && (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/90">
                      {event.note}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {event.actor
                      ? `${event.actor.name} · ${t(`roles.${event.actor.role}`)}`
                      : "System"}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </Card>
  );
}

// ─────────────────────────── Evaluation card ───────────────────────────

function EvaluationCard({ app }: { app: CaseDetail }) {
  const t = useT();
  const latest = app.evaluationResults[0] ?? null;
  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calculator className="size-4 text-primary" aria-hidden />
          <h3 className="text-sm font-semibold">{t("application.evaluation")}</h3>
        </div>
        {latest && <StatusBadge status={latest.status} />}
      </div>
      {latest ? (
        <>
          <Row label={t("public.governingSurface")} value={latest.governingSurface ?? "—"} />
          <Row
            label={t("public.permissibleTopElevation")}
            value={
              latest.ptE_amslM != null ? `${formatMetres(latest.ptE_amslM)} AMSL` : "—"
            }
          />
          <Row
            label={t("public.permissibleHeight")}
            value={
              latest.permissibleAglM != null ? `${formatMetres(latest.permissibleAglM)} AGL` : "—"
            }
          />
          <Row
            label={t("public.penetration")}
            value={
              latest.penetrationM != null && latest.penetrationM > 0 ? (
                <span className="text-destructive">{formatMetres(latest.penetrationM)}</span>
              ) : (
                t("common.none")
              )
            }
          />
          <Row label="Computed" value={formatDateTime(latest.computedAt)} />
          <p className="mt-2 text-xs text-muted-foreground">{t("public.disclaimer")}</p>
        </>
      ) : (
        <p className="py-2 text-sm text-muted-foreground">
          Indicative OLS evaluation has not been computed for this case yet.
        </p>
      )}
    </Card>
  );
}

// ─────────────────────────── Main component ───────────────────────────

export function AuthorityCaseDetail({ id }: { id: string }) {
  const t = useT();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["application", id],
    queryFn: () => fetchJson<CaseDetailResponse>(`/api/applications/${id}`),
    retry: (failureCount, err) =>
      err instanceof ApiError && (err.status === 404 || err.status === 403)
        ? false
        : failureCount < 2,
  });

  const app = data?.application;
  const latestEval = app?.evaluationResults[0] ?? null;

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
                ? "This application belongs to a different jurisdiction."
                : "The application may have been removed, or the link is incorrect."
            }
            action={
              <Button asChild variant="outline">
                <Link href="/authority">
                  {t("common.back")} — {t("application.authority")}
                </Link>
              </Button>
            }
          />
        ) : (
          <>
            <PageHeader
              crumbs={[
                { label: t("nav.dashboard"), href: "/dashboard" },
                { label: t("application.authority"), href: "/authority" },
                { label: app.refNo },
              ]}
              title={
                <span className="flex flex-wrap items-center gap-2.5">
                  <span className="tabular-nums">{app.refNo}</span>
                  <StatusBadge status={app.status} />
                </span>
              }
              description={`${app.structureType} · ${app.airport.icao} — ${app.airport.name}, ${app.airport.city}`}
              actions={
                app.authorityOrg ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium">
                    <Landmark className="size-3.5 text-primary" aria-hidden />
                    {app.authorityOrg.name}
                    {app.authorityOrg.city && (
                      <span className="text-muted-foreground">· {app.authorityOrg.city}</span>
                    )}
                  </span>
                ) : undefined
              }
            />

            <FadeIn delay={0.05}>
              <StatusHero detail={data} />
            </FadeIn>

            <Stagger className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <StaggerItem>
                  <Card className="p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <UserRound className="size-4 text-primary" aria-hidden />
                      <h3 className="text-sm font-semibold">{t("application.applicant")}</h3>
                    </div>
                    <Row label="Organisation" value={app.applicantOrg.name} />
                    <Row label="City" value={app.applicantOrg.city ?? "—"} />
                    <Row label="Contact" value={app.applicantOrg.contact ?? "—"} />
                    <Row label="Trade license" value={app.applicantOrg.tradeLicense ?? "—"} />
                    <Separator className="my-2" />
                    <Row
                      label="Created by"
                      value={
                        <span>
                          {app.createdBy.name}
                          <span className="block text-xs font-normal text-muted-foreground">
                            {app.createdBy.email}
                          </span>
                        </span>
                      }
                    />
                  </Card>
                </StaggerItem>

                <StaggerItem>
                  <Card className="p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <MapPin className="size-4 text-primary" aria-hidden />
                      <h3 className="text-sm font-semibold">{t("application.site")}</h3>
                    </div>
                    <Row label={t("application.structureType")} value={app.structureType} />
                    <Row label={t("application.siteAddress")} value={app.siteAddress ?? "—"} />
                    <Row
                      label={t("application.coordinates")}
                      value={<span className="tabular-nums">{formatCoords(app.lat, app.lon)}</span>}
                    />
                    <Row
                      label={t("application.groundElevation")}
                      value={`${formatMetres(app.groundElevationM)} AMSL`}
                    />
                    <Row
                      label={t("application.requestedHeight")}
                      value={`${formatMetres(app.requestedHeightAglM)} AGL`}
                    />
                    <Row
                      label={t("application.requestedTop")}
                      value={`${formatMetres(app.requestedTopElevationAmslM)} AMSL`}
                    />
                    <Separator className="my-2" />
                    <Row label={t("application.submittedOn")} value={formatDate(app.submittedAt)} />
                  </Card>
                </StaggerItem>

                <StaggerItem>
                  <EvaluationCard app={app} />
                </StaggerItem>

                <StaggerItem>
                  <DocumentsCard app={app} />
                </StaggerItem>
              </div>

              <div className="space-y-4">
                <StaggerItem>
                  <Card className="overflow-hidden p-0">
                    <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                      <h3 className="text-sm font-semibold">
                        {app.airport.icao} — {app.airport.name}
                      </h3>
                      {latestEval && <StatusBadge status={latestEval.status} />}
                    </div>
                    {data.map ? (
                      <>
                        <OlsMap
                          center={[app.lon, app.lat]}
                          zoom={11}
                          surfaces={data.map.surfaces}
                          runways={data.map.runways}
                          site={{ lat: app.lat, lon: app.lon }}
                          siteStatus={latestEval?.status ?? "NONE"}
                          interactive={false}
                          className="h-[360px] w-full"
                        />
                        <div className="border-t px-4 py-2">
                          <OlsLegend />
                        </div>
                      </>
                    ) : (
                      <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
                        Map unavailable for this aerodrome
                      </div>
                    )}
                  </Card>
                </StaggerItem>

                <StaggerItem>
                  <TimelineCard events={app.caseEvents} />
                </StaggerItem>
              </div>
            </Stagger>
          </>
        )}
      </SkeletonSwap>
    </PageTransition>
  );
}
