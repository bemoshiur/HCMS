"use client";

/**
 * Analytics tab — date-range + airport filter bar feeding
 * GET /api/reports/analytics; KPI StatCards + charts grid + authority league.
 */
import * as React from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { AlertTriangle, Building2, Gauge, RefreshCw, Timer, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonSwap, Stagger } from "@/components/motion";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { useT } from "@/components/providers";
import {
  ByAirportChart,
  ByStructureTypeChart,
  ChartCard,
  OutcomesDonut,
  ThroughputChart,
  TurnaroundHistogram,
} from "./analytics-charts";
import {
  analyticsQueryString,
  fetchJson,
  type AirportOption,
  type AnalyticsFilters,
  type AnalyticsResponse,
} from "./types";

const ALL_AIRPORTS = "__all__";

type AuthorityRow = AnalyticsResponse["byAuthority"][number];

export function AnalyticsTab({
  filters,
  onFiltersChange,
}: {
  filters: AnalyticsFilters;
  onFiltersChange: (next: AnalyticsFilters) => void;
}) {
  const t = useT();

  const airportsQ = useQuery({
    queryKey: ["airports"],
    queryFn: () => fetchJson<AirportOption[]>("/api/airports"),
    staleTime: 10 * 60_000,
  });

  const analyticsQ = useQuery({
    queryKey: ["reports-analytics", filters.icao, filters.from, filters.to],
    queryFn: () =>
      fetchJson<AnalyticsResponse>(`/api/reports/analytics${analyticsQueryString(filters)}`),
    placeholderData: keepPreviousData,
  });

  const data = analyticsQ.data;
  const loading = analyticsQ.isLoading;
  const hasFilters = !!(filters.icao || filters.from || filters.to);

  const authorityColumns = React.useMemo<ColumnDef<AuthorityRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("application.authority"),
        cell: ({ row }) => (
          <span className="block max-w-64 truncate font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "total",
        header: t("common.total"),
        cell: ({ row }) => <span className="tabular-nums">{row.original.total}</span>,
      },
      {
        accessorKey: "endorsed",
        header: t("status.ENDORSED"),
        cell: ({ row }) => <span className="tabular-nums">{row.original.endorsed}</span>,
      },
      {
        accessorKey: "avgEndorseDays",
        header: "Avg endorse days",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.original.avgEndorseDays == null
              ? "—"
              : row.original.avgEndorseDays.toLocaleString("en-US", {
                  maximumFractionDigits: 1,
                })}
          </span>
        ),
      },
    ],
    [t]
  );

  return (
    <div className="space-y-4">
      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-lg border bg-card px-3 py-2.5 shadow-sm">
        <div className="flex flex-col gap-1">
          <Label htmlFor="analytics-airport" className="text-xs text-muted-foreground">
            {t("common.airport")}
          </Label>
          <Select
            value={filters.icao || ALL_AIRPORTS}
            onValueChange={(v) =>
              onFiltersChange({ ...filters, icao: v === ALL_AIRPORTS ? "" : v })
            }
            disabled={airportsQ.isLoading}
          >
            <SelectTrigger id="analytics-airport" className="h-9 w-48 md:w-64">
              <SelectValue placeholder={t("common.all")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_AIRPORTS}>
                {t("common.all")} — {t("common.airport").toLowerCase()}s
              </SelectItem>
              {(airportsQ.data ?? []).map((a) => (
                <SelectItem key={a.icao} value={a.icao}>
                  {a.icao} — {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="analytics-from" className="text-xs text-muted-foreground">
            {t("common.from")}
          </Label>
          <Input
            id="analytics-from"
            type="date"
            className="h-9 w-40"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => onFiltersChange({ ...filters, from: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="analytics-to" className="text-xs text-muted-foreground">
            {t("common.to")}
          </Label>
          <Input
            id="analytics-to"
            type="date"
            className="h-9 w-40"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => onFiltersChange({ ...filters, to: e.target.value })}
          />
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => onFiltersChange({ icao: "", from: "", to: "" })}
          >
            {t("common.clearFilters")}
          </Button>
        )}
        {analyticsQ.isFetching && !loading && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="size-3.5 animate-spin" aria-hidden />
            {t("common.loading")}
          </span>
        )}
      </div>

      {analyticsQ.isError ? (
        <EmptyState
          icon={AlertTriangle}
          title={t("common.error")}
          description={(analyticsQ.error as Error)?.message}
          action={
            <Button variant="outline" onClick={() => analyticsQ.refetch()}>
              <RefreshCw className="size-4" aria-hidden />
              {t("common.retry")}
            </Button>
          }
        />
      ) : (
        <>
          {/* ── KPI row: turnaround percentiles + SLA compliance ── */}
          <SkeletonSwap
            loading={loading}
            skeleton={
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-[104px] rounded-xl" />
                ))}
              </div>
            }
          >
            {data && (
              <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard
                  label="Avg turnaround"
                  value={data.turnaround.avgDays}
                  suffix=" days"
                  decimals={1}
                  icon={Timer}
                  hint="Submission to decision"
                />
                <StatCard
                  label="Median (p50)"
                  value={data.turnaround.p50}
                  suffix=" days"
                  decimals={1}
                  icon={TrendingUp}
                  tone="info"
                  hint="Half of the cases decided faster"
                />
                <StatCard
                  label="90th percentile (p90)"
                  value={data.turnaround.p90}
                  suffix=" days"
                  decimals={1}
                  icon={TrendingUp}
                  tone="warning"
                  hint="9 in 10 cases decided faster"
                />
                <StatCard
                  label="SLA compliance"
                  value={data.sla.rate}
                  suffix="%"
                  decimals={1}
                  icon={Gauge}
                  tone={data.sla.rate >= 80 ? "success" : "warning"}
                  hint={`${data.sla.compliant.toLocaleString("en-US")} active cases within SLA`}
                />
                <StatCard
                  label="SLA breached"
                  value={data.sla.breached}
                  icon={AlertTriangle}
                  tone="danger"
                  hint="Active cases past their SLA due date"
                />
              </Stagger>
            )}
          </SkeletonSwap>

          {/* ── Charts grid ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="12-month throughput" loading={loading}>
              {data && <ThroughputChart data={data.throughput} />}
            </ChartCard>
            <ChartCard title="Outcome mix" loading={loading}>
              {data && <OutcomesDonut data={data.outcomes} />}
            </ChartCard>
            <ChartCard title="Cleared vs objections by airport" loading={loading}>
              {data && <ByAirportChart data={data.byAirport} />}
            </ChartCard>
            <ChartCard title="Structure types and average height" loading={loading}>
              {data && <ByStructureTypeChart data={data.byStructureType} />}
            </ChartCard>
            <ChartCard title="Turnaround distribution" loading={loading}>
              {data && <TurnaroundHistogram data={data.turnaround.buckets} />}
            </ChartCard>

            {/* ── Authority league table ── */}
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="size-4 text-muted-foreground" aria-hidden />
                  Approving-authority league (top 10)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                <DataTable<AuthorityRow>
                  columns={authorityColumns}
                  data={data?.byAuthority ?? []}
                  loading={loading}
                  searchable={false}
                  pageSize={10}
                  initialSorting={[{ id: "total", desc: true }]}
                  emptyTitle="No endorsements yet"
                  emptyDescription="Authority activity will appear here once applications are endorsed."
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
