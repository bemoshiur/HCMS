"use client";

// Audit trail viewer (brief §17): KPI cards, filterable append-only log, a
// readable before/after diff per record, and a full server-side CSV export.
// The trail is immutable — there are deliberately no edit/delete affordances.
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  CalendarClock,
  Eye,
  FilterX,
  Loader2,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PageTransition, Stagger, SkeletonSwap } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateTime, downloadBlob } from "@/lib/format";
import { useT } from "@/components/providers";
import { cn } from "@/lib/utils";
import { AuditDetailDialog } from "./audit-detail-dialog";
import {
  buildAuditQuery,
  EMPTY_FILTERS,
  fetchJson,
  type AuditFilters,
  type AuditPayload,
  type AuditRow,
} from "./types";

function actorRoleLabel(t: (p: string) => string, role: string): string {
  const label = t(`roles.${role}`);
  return label === `roles.${role}` ? role : label;
}

export function AuditClient() {
  const t = useT();
  const [filters, setFilters] = React.useState<AuditFilters>(EMPTY_FILTERS);
  const [detail, setDetail] = React.useState<AuditRow | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const queryString = React.useMemo(() => buildAuditQuery(filters), [filters]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["audit", filters],
    queryFn: () => fetchJson<AuditPayload>(`/api/audit${queryString}`),
  });

  const items = React.useMemo(() => data?.items ?? [], [data?.items]);
  const stats = data?.stats;
  const facets = data?.facets;

  const filtersActive =
    filters.action !== "all" ||
    filters.entity !== "all" ||
    filters.actor !== "all" ||
    !!filters.from ||
    !!filters.to;

  const setFilter = React.useCallback(
    <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) =>
      setFilters((prev) => ({ ...prev, [key]: value })),
    []
  );

  const handleExport = React.useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/audit${buildAuditQuery(filters, { format: "csv" })}`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      downloadBlob(blob, `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success("Audit trail exported");
    } catch (error) {
      toast.error(t("common.error"), { description: (error as Error).message });
    } finally {
      setExporting(false);
    }
  }, [filters, t]);

  const columns = React.useMemo<ColumnDef<AuditRow, unknown>[]>(
    () => [
      {
        accessorKey: "at",
        header: t("common.date"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-sm">
            {formatDateTime(row.original.at)}
          </span>
        ),
      },
      {
        id: "actor",
        accessorFn: (row) => row.actor?.name ?? "System",
        header: "Actor",
        cell: ({ row }) => {
          const actor = row.original.actor;
          if (!actor) {
            return (
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Activity className="size-3.5" aria-hidden />
                System
              </span>
            );
          }
          return (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{actor.name}</p>
              <Badge variant="secondary" className="mt-0.5 font-normal">
                {actorRoleLabel(t, actor.role)}
              </Badge>
            </div>
          );
        },
      },
      {
        accessorKey: "action",
        header: "Action",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono text-[11px]">
            {row.original.action}
          </Badge>
        ),
      },
      {
        id: "entity",
        accessorFn: (row) => `${row.entity} ${row.entityId ?? ""}`,
        header: "Entity",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-sm font-medium">{row.original.entity}</p>
            {row.original.entityId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="max-w-40 truncate font-mono text-xs text-muted-foreground">
                    {row.original.entityId}
                  </p>
                </TooltipTrigger>
                <TooltipContent className="font-mono">{row.original.entityId}</TooltipContent>
              </Tooltip>
            )}
          </div>
        ),
      },
      {
        id: "details",
        header: () => <span className="sr-only">{t("common.details")}</span>,
        enableSorting: false,
        size: 48,
        cell: ({ row }) => {
          const hasData = row.original.before != null || row.original.after != null;
          return (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              disabled={!hasData}
              onClick={(e) => {
                e.stopPropagation();
                setDetail(row.original);
              }}
              aria-label={`${t("common.details")} — ${row.original.action}`}
            >
              <Eye className="size-4" aria-hidden />
              {t("common.details")}
            </Button>
          );
        },
      },
    ],
    [t]
  );

  return (
    <PageTransition className="p-4 md:p-6">
      <PageHeader
        crumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("nav.audit") },
        ]}
        title={t("nav.audit")}
        description="Append-only record of every state change and administrative action across the system. Records cannot be edited or deleted."
        actions={
          <>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn("size-4", isFetching && "animate-spin")} aria-hidden />
              {t("common.refresh")}
            </Button>
            <Button onClick={handleExport} disabled={exporting || (stats?.total ?? 0) === 0}>
              {exporting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ScrollText className="size-4" aria-hidden />
              )}
              {t("common.exportCsv")}
            </Button>
          </>
        }
      />

      {/* KPI cards */}
      <SkeletonSwap
        loading={isLoading}
        skeleton={
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        }
      >
        <Stagger className="mb-6 grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Total events"
            value={stats?.total ?? 0}
            icon={ScrollText}
            hint={filtersActive ? "Matching current filters" : "All recorded events"}
          />
          <StatCard
            label="Today"
            value={stats?.today ?? 0}
            icon={CalendarClock}
            tone="info"
            hint="Events recorded today"
          />
          <StatCard
            label="Distinct actors"
            value={stats?.distinctActors ?? 0}
            icon={Users}
            tone="success"
            hint="Unique users in this view"
          />
        </Stagger>
      </SkeletonSwap>

      <DataTable<AuditRow>
        columns={columns}
        data={items}
        loading={isLoading}
        searchable
        searchPlaceholder={`${t("common.search")} — action, entity, ID…`}
        initialSorting={[{ id: "at", desc: true }]}
        pageSize={20}
        emptyTitle="No audit records"
        emptyDescription="No events match the current filters. Adjust the filters or widen the date range."
        toolbar={
          <>
            <Select value={filters.action} onValueChange={(v) => setFilter("action", v)}>
              <SelectTrigger className="h-9 w-44" aria-label="Filter by action">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")} — actions</SelectItem>
                {(facets?.actions ?? []).map((action) => (
                  <SelectItem key={action} value={action} className="font-mono text-xs">
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.entity} onValueChange={(v) => setFilter("entity", v)}>
              <SelectTrigger className="h-9 w-40" aria-label="Filter by entity">
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")} — entities</SelectItem>
                {(facets?.entities ?? []).map((entity) => (
                  <SelectItem key={entity} value={entity}>
                    {entity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.actor} onValueChange={(v) => setFilter("actor", v)}>
              <SelectTrigger className="h-9 w-44" aria-label="Filter by actor">
                <SelectValue placeholder="Actor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")} — actors</SelectItem>
                {facets?.hasSystem && <SelectItem value="system">System</SelectItem>}
                {(facets?.actors ?? []).map((actor) => (
                  <SelectItem key={actor.id} value={actor.id}>
                    {actor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5">
              <Label htmlFor="audit-from" className="sr-only">
                {t("common.from")}
              </Label>
              <Input
                id="audit-from"
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(e) => setFilter("from", e.target.value)}
                className="h-9 w-[9.5rem]"
                aria-label={t("common.from")}
              />
              <span className="text-muted-foreground" aria-hidden>
                –
              </span>
              <Label htmlFor="audit-to" className="sr-only">
                {t("common.to")}
              </Label>
              <Input
                id="audit-to"
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(e) => setFilter("to", e.target.value)}
                className="h-9 w-[9.5rem]"
                aria-label={t("common.to")}
              />
            </div>

            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="h-9"
              >
                <FilterX className="size-4" aria-hidden />
                {t("common.clearFilters")}
              </Button>
            )}
          </>
        }
      />

      {/* Immutability framing */}
      <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-success" aria-hidden />
        Audit trail is immutable — records are append-only and cannot be modified or removed.
      </p>

      <AuditDetailDialog record={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </PageTransition>
  );
}
