"use client";

// Approving authority workspace (§17): jurisdiction KPIs, endorsement queue
// (SUBMITTED first, filterable across all statuses) and the monthly
// endorsed/returned trend. Row click opens /authority/applications/[id].
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { differenceInCalendarDays } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Landmark,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageTransition, Stagger, FadeIn } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { useT } from "@/components/providers";
import { formatDate, formatCoords } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fetchJson, type AuthorityOverviewResponse, type QueueItem } from "./api";
import { EndorsementTrendCard } from "./authority-chart";

const ALL = "__all__";

// Authority never sees applicant private drafts — DRAFT intentionally absent.
const STATUS_OPTIONS = [
  "SUBMITTED",
  "ENDORSED",
  "INTAKE_SCRUTINY",
  "UNDER_REVIEW",
  "STUDY",
  "DECISION_PENDING",
  "APPROVED",
  "REJECTED",
  "RETURNED_FOR_INFO",
  "CERTIFICATE_ISSUED",
  "REVALIDATION",
  "EXPIRED",
  "REVOKED",
] as const;

function daysWaiting(submittedAt: string | null): number {
  if (!submittedAt) return 0;
  return Math.max(0, differenceInCalendarDays(new Date(), new Date(submittedAt)));
}

/** SLA-style "waiting N days" chip for cases pending endorsement. */
export function WaitingChip({
  submittedAt,
  className,
}: {
  submittedAt: string | null;
  className?: string;
}) {
  const days = daysWaiting(submittedAt);
  const tone =
    days > 7
      ? "bg-destructive/10 text-destructive border-destructive/25"
      : days > 3
        ? "bg-warning/10 text-warning border-warning/25"
        : "bg-success/10 text-success border-success/25";
  const Icon = days > 7 ? AlertTriangle : Clock;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums whitespace-nowrap",
        tone,
        className
      )}
    >
      <Icon className="size-3" aria-hidden />
      {days === 0 ? "Today" : `${days}d waiting`}
    </span>
  );
}

export function AuthorityWorkspace({
  orgName,
  jurisdiction,
}: {
  orgName: string | null;
  jurisdiction: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState<string>("SUBMITTED");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["authority", "overview"],
    queryFn: () => fetchJson<AuthorityOverviewResponse>("/api/authority/stats"),
  });

  React.useEffect(() => {
    if (isError) toast.error(error instanceof Error ? error.message : t("common.error"));
  }, [isError, error, t]);

  const items = React.useMemo(() => data?.items ?? [], [data]);
  const stats = data?.stats;

  const filtered = React.useMemo(
    () => (statusFilter === ALL ? items : items.filter((i) => i.status === statusFilter)),
    [items, statusFilter]
  );

  const quickTabs = React.useMemo(
    () => [
      {
        value: "SUBMITTED",
        label: "Pending endorsement",
        count: items.filter((i) => i.status === "SUBMITTED").length,
      },
      {
        value: "ENDORSED",
        label: t("status.ENDORSED"),
        count: items.filter((i) => i.status === "ENDORSED").length,
      },
      {
        value: "RETURNED_FOR_INFO",
        label: t("status.RETURNED_FOR_INFO"),
        count: items.filter((i) => i.status === "RETURNED_FOR_INFO").length,
      },
      { value: ALL, label: t("common.all"), count: items.length },
    ],
    [items, t]
  );

  const columns = React.useMemo<ColumnDef<QueueItem, unknown>[]>(
    () => [
      {
        id: "refNo",
        accessorFn: (r) => r.refNo,
        header: t("application.refNo"),
        cell: ({ row }) => (
          <span className="font-medium text-primary whitespace-nowrap">{row.original.refNo}</span>
        ),
      },
      {
        id: "applicant",
        accessorFn: (r) => r.applicantOrg.name,
        header: t("application.applicant"),
        cell: ({ row }) => (
          <span className="block max-w-44 truncate" title={row.original.applicantOrg.name}>
            {row.original.applicantOrg.name}
          </span>
        ),
      },
      {
        id: "airport",
        accessorFn: (r) => r.airport.icao,
        header: t("common.airport"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            <span className="font-medium">{row.original.airport.icao}</span>{" "}
            <span className="hidden text-muted-foreground xl:inline">
              — {row.original.airport.city}
            </span>
          </span>
        ),
      },
      {
        id: "structureType",
        accessorFn: (r) => r.structureType,
        header: t("application.structureType"),
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.structureType}</span>,
      },
      {
        id: "height",
        accessorFn: (r) => r.requestedHeightAglM,
        header: () => <span className="whitespace-nowrap">{t("application.requestedHeight")}</span>,
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.requestedHeightAglM.toFixed(1)} m</span>
        ),
      },
      {
        id: "site",
        accessorFn: (r) => r.siteAddress ?? formatCoords(r.lat, r.lon),
        header: t("application.siteAddress"),
        cell: ({ row }) => {
          const site = row.original.siteAddress ?? formatCoords(row.original.lat, row.original.lon);
          return (
            <span className="block max-w-52 truncate text-muted-foreground" title={site}>
              {site}
            </span>
          );
        },
      },
      {
        id: "submitted",
        accessorFn: (r) => (r.submittedAt ? new Date(r.submittedAt).getTime() : 0),
        header: t("application.submittedOn"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.submittedAt)}
          </span>
        ),
      },
      {
        id: "waiting",
        accessorFn: (r) => (r.status === "SUBMITTED" ? daysWaiting(r.submittedAt) : -1),
        header: "Waiting",
        cell: ({ row }) =>
          row.original.status === "SUBMITTED" ? (
            <WaitingChip submittedAt={row.original.submittedAt} />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "status",
        accessorFn: (r) => r.status,
        header: t("common.status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [t]
  );

  return (
    <PageTransition>
      <PageHeader
        title={t("application.authority")}
        description="Endorse and forward height clearance applications in your jurisdiction to CAAB, or return them to the applicant with remarks."
        crumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("application.authority") },
        ]}
        actions={
          orgName ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium">
              <Landmark className="size-3.5 text-primary" aria-hidden />
              {orgName}
              {jurisdiction && <span className="text-muted-foreground">· {jurisdiction}</span>}
            </span>
          ) : undefined
        }
      />

      {/* KPI row + trend chart */}
      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <Stagger className="grid grid-cols-2 gap-3 xl:col-span-2">
          <StatCard
            label="Pending endorsement"
            value={stats?.pendingEndorsement ?? 0}
            icon={Inbox}
            tone="warning"
            hint="Submitted — awaiting your action"
          />
          <StatCard
            label="Endorsed this month"
            value={stats?.endorsedThisMonth ?? 0}
            icon={CheckCircle2}
            tone="success"
            hint="Forwarded to CAAB intake"
          />
          <StatCard
            label="Returned to applicants"
            value={stats?.returned ?? 0}
            icon={RotateCcw}
            tone="default"
            hint="Sent back with remarks"
          />
          <StatCard
            label="Total forwarded"
            value={stats?.totalForwarded ?? 0}
            icon={Send}
            tone="info"
            hint="All-time endorsements"
          />
        </Stagger>
        <EndorsementTrendCard data={data?.monthly ?? []} loading={isLoading} />
      </div>

      {/* Queue */}
      <FadeIn delay={0.05}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight">{t("nav.queue")}</h2>
          <div role="group" aria-label="Filter queue by status" className="flex flex-wrap items-center gap-1.5">
            {quickTabs.map((tab) => {
              const active = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-[10px] tabular-nums",
                      active ? "bg-primary-foreground/20" : "bg-muted"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <DataTable<QueueItem>
          columns={columns}
          data={filtered}
          loading={isLoading}
          searchable
          searchPlaceholder={`${t("common.search")} — ref, applicant, site…`}
          pageSize={10}
          initialSorting={[{ id: "waiting", desc: true }]}
          onRowClick={(row) => router.push(`/authority/applications/${row.id}`)}
          emptyTitle={
            statusFilter === "SUBMITTED"
              ? "No applications awaiting endorsement"
              : t("common.noResults")
          }
          emptyDescription={
            statusFilter === "SUBMITTED"
              ? "New submissions in your jurisdiction will appear here for endorsement."
              : "Try a different status filter."
          }
          emptyAction={
            statusFilter !== ALL ? (
              <Button variant="outline" size="sm" onClick={() => setStatusFilter(ALL)}>
                <X className="size-4" aria-hidden />
                {t("common.clearFilters")}
              </Button>
            ) : undefined
          }
          exportCsv={{
            filename: `authority-queue-${new Date().toISOString().slice(0, 10)}.csv`,
            headers: [
              "Ref No",
              "Applicant",
              "Airport",
              "Structure",
              "Height (m AGL)",
              "Site address",
              "Status",
              "Submitted",
              "Days waiting",
            ],
            row: (r) => [
              r.refNo,
              r.applicantOrg.name,
              r.airport.icao,
              r.structureType,
              r.requestedHeightAglM,
              r.siteAddress ?? formatCoords(r.lat, r.lon),
              r.status,
              r.submittedAt ? formatDate(r.submittedAt) : "",
              r.status === "SUBMITTED" ? daysWaiting(r.submittedAt) : "",
            ],
          }}
          toolbar={
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger size="sm" aria-label={t("common.status")} className="w-[170px]">
                <SelectValue placeholder={t("common.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>
                  {t("common.all")} — {t("common.status").toLowerCase()}
                </SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      </FadeIn>
    </PageTransition>
  );
}
