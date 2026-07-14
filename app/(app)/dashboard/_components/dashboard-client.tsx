"use client";

/**
 * Role-aware dashboard — KPI row, throughput/outcome charts, role queue,
 * recent applications. All figures come from GET /api/dashboard, which
 * scopes rows exactly like the applications list (never trusts the client).
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileStack,
  Gauge,
  RefreshCw,
  Timer,
  XCircle,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition, SkeletonSwap, Stagger } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { useT } from "@/components/providers";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ByAirportChart,
  ByStructureTypeChart,
  ChartCard,
  MonthlyThroughputChart,
  OutcomesDonut,
} from "./charts";
import { MyQueueCard } from "./my-queue-card";
import type { DashboardData } from "./types";

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch("/api/dashboard");
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to load dashboard");
  }
  return res.json() as Promise<DashboardData>;
}

function roleSubtitle(role: Role): string {
  switch (role) {
    case "APPLICANT":
      return "Your organisation's height clearance applications at a glance.";
    case "AUTHORITY_OFFICER":
      return "Applications routed through your approving authority.";
    case "INTAKE_OFFICER":
      return "Intake workload, throughput and SLA compliance.";
    case "AGA_REVIEWER":
    case "CNS_REVIEWER":
    case "PANSOPS_REVIEWER":
      return "Discipline review workload and clearance throughput.";
    case "APPROVER":
      return "Decisions pending, outcomes and SLA compliance.";
    case "STUDY_OFFICER":
      return "Aeronautical studies and system-wide throughput.";
    case "AUDITOR":
      return "System-wide caseload, outcomes and SLA compliance (read-only).";
    default:
      return "System-wide caseload, outcomes and SLA compliance.";
  }
}

/** Application detail route differs for portal roles. */
function applicationHref(role: Role | undefined, id: string): string {
  if (role === "APPLICANT") return `/portal/applications/${id}`;
  if (role === "AUTHORITY_OFFICER") return `/authority/applications/${id}`;
  return `/applications/${id}`;
}

type RecentRow = DashboardData["recent"][number];

export function DashboardClient() {
  const t = useT();
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });

  const handleRefresh = React.useCallback(async () => {
    const result = await refetch();
    if (result.error) toast.error(t("common.error"));
    else toast.success("Dashboard refreshed");
  }, [refetch, t]);

  const recentColumns = React.useMemo<ColumnDef<RecentRow, unknown>[]>(
    () => [
      {
        accessorKey: "refNo",
        header: t("application.refNo"),
        cell: ({ row }) => (
          <span className="font-medium text-primary">{row.original.refNo}</span>
        ),
      },
      {
        accessorKey: "applicantName",
        header: t("application.applicant"),
        cell: ({ row }) => (
          <span className="block max-w-56 truncate">{row.original.applicantName}</span>
        ),
      },
      { accessorKey: "airportIcao", header: t("common.airport") },
      {
        accessorKey: "status",
        header: t("common.status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "submittedAt",
        header: t("application.submittedOn"),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatDate(row.original.submittedAt)}
          </span>
        ),
      },
    ],
    [t]
  );

  const kpis = data?.kpis;

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title={t("nav.dashboard")}
        description={
          data ? `${t(`roles.${data.role}`)} — ${roleSubtitle(data.role)}` : undefined
        }
        crumbs={[{ label: t("nav.overview") }, { label: t("nav.dashboard") }]}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/reports">
                <BarChart3 className="size-4" aria-hidden />
                {t("nav.reports")}
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || isRefetching}
              aria-label={t("common.refresh")}
            >
              <RefreshCw className={cn("size-4", isRefetching && "animate-spin")} aria-hidden />
              {t("common.refresh")}
            </Button>
          </>
        }
      />

      {isError ? (
        <EmptyState
          icon={AlertTriangle}
          title={t("common.error")}
          description="The dashboard data could not be loaded. Please try again."
          action={
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="size-4" aria-hidden />
              {t("common.retry")}
            </Button>
          }
        />
      ) : (
        <>
          {/* ── KPI row ── */}
          <SkeletonSwap
            loading={isLoading}
            skeleton={
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[104px] rounded-xl" />
                ))}
              </div>
            }
          >
            {kpis && (
              <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <StatCard
                  label={t("nav.applications")}
                  value={kpis.total}
                  icon={FileStack}
                  hint={`${kpis.certificatesIssued.toLocaleString("en-US")} certificates issued`}
                />
                <StatCard
                  label="In progress"
                  value={kpis.inProgress}
                  icon={Clock3}
                  tone="info"
                  hint="Active cases in the pipeline"
                />
                <StatCard
                  label={t("status.APPROVED")}
                  value={kpis.approved}
                  icon={CheckCircle2}
                  tone="success"
                  hint={`Avg permissible height ${kpis.avgPermissibleHeight.toLocaleString("en-US", { maximumFractionDigits: 1 })} m`}
                />
                <StatCard
                  label="Objections"
                  value={kpis.objections}
                  icon={XCircle}
                  tone="danger"
                  hint="Rejected or revoked cases"
                />
                <StatCard
                  label="Avg turnaround"
                  value={kpis.avgTurnaroundDays}
                  icon={Timer}
                  suffix=" days"
                  decimals={1}
                  hint="Submission to decision"
                />
                <StatCard
                  label="SLA compliance"
                  value={kpis.slaComplianceRate}
                  icon={Gauge}
                  suffix="%"
                  decimals={1}
                  tone={kpis.slaComplianceRate >= 80 ? "success" : "warning"}
                  hint="Active cases within SLA"
                />
              </Stagger>
            )}
          </SkeletonSwap>

          {/* ── Charts ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Monthly throughput" loading={isLoading}>
              {data && <MonthlyThroughputChart data={data.monthly} />}
            </ChartCard>
            <ChartCard title="Outcome mix" loading={isLoading}>
              {data && <OutcomesDonut data={data.outcomes} />}
            </ChartCard>
            <ChartCard title="Applications by airport" loading={isLoading}>
              {data && <ByAirportChart data={data.byAirport} />}
            </ChartCard>
            <ChartCard title="Top structure types" loading={isLoading}>
              {data && <ByStructureTypeChart data={data.byStructureType} />}
            </ChartCard>
          </div>

          {/* ── Queue + recent applications ── */}
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {data?.myQueue && <MyQueueCard queue={data.myQueue} className="lg:col-span-1" />}
            <Card
              className={cn(
                "gap-3 py-4",
                data?.myQueue ? "lg:col-span-2" : "lg:col-span-3"
              )}
            >
              <CardHeader className="px-4">
                <CardTitle className="text-sm font-medium">Recent applications</CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                <DataTable<RecentRow>
                  columns={recentColumns}
                  data={data?.recent ?? []}
                  loading={isLoading}
                  searchable={false}
                  pageSize={10}
                  onRowClick={(row) => router.push(applicationHref(data?.role, row.id))}
                  emptyTitle="No applications yet"
                  emptyDescription="New cases will appear here as soon as they are created."
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PageTransition>
  );
}
