"use client";

// Obstacle register (brief §17): KPI cards, table/map toggle, filters,
// compliance re-check, manual status determination and CSV export.
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Eye,
  ListChecks,
  Map as MapIcon,
  MapPin,
  MonitorDot,
  MoreHorizontal,
  Mountain,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Table2,
} from "lucide-react";
import { PageTransition, Stagger, SkeletonSwap } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCoords, formatMetres, timeAgo } from "@/lib/format";
import { useT } from "@/components/providers";
import { cn } from "@/lib/utils";
import { AddObstacleDialog } from "./add-obstacle-dialog";
import { SetStatusDialog } from "./set-status-dialog";
import { ObstaclesMapView } from "./obstacles-map-view";
import {
  checkSummary,
  fetchJson,
  OBSTACLE_SOURCES,
  OBSTACLE_STATUSES,
  SOURCE_LABELS,
  type AirportOption,
  type CheckResponse,
  type ObstacleRow,
  type ObstaclesPayload,
} from "./types";

export function ObstaclesClient() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [view, setView] = React.useState<"table" | "map">("table");
  const [airportFilter, setAirportFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [structureFilter, setStructureFilter] = React.useState("all");
  const [addOpen, setAddOpen] = React.useState(false);
  const [statusRow, setStatusRow] = React.useState<ObstacleRow | null>(null);
  const [focused, setFocused] = React.useState<ObstacleRow | null>(null);

  const queryString = React.useMemo(() => {
    const params = new URLSearchParams();
    if (airportFilter !== "all") params.set("icao", airportFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (structureFilter !== "all") params.set("structureType", structureFilter);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [airportFilter, statusFilter, sourceFilter, structureFilter]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["obstacles", airportFilter, statusFilter, sourceFilter, structureFilter],
    queryFn: () => fetchJson<ObstaclesPayload>(`/api/obstacles${queryString}`),
  });

  const airportsQ = useQuery({
    queryKey: ["airports"],
    queryFn: () => fetchJson<AirportOption[]>("/api/airports"),
    staleTime: 10 * 60_000,
  });
  const airports = airportsQ.data ?? [];

  const items = React.useMemo(() => data?.items ?? [], [data?.items]);
  const canManage = data?.canManage ?? false;
  const stats = data?.stats;

  // Structure-type filter options stay sticky while a value is selected.
  const structureTypes = React.useMemo(() => {
    const set = new Set(items.map((i) => i.structureType));
    if (structureFilter !== "all") set.add(structureFilter);
    return Array.from(set).sort();
  }, [items, structureFilter]);

  const checkMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson<CheckResponse>(`/api/obstacles/${id}/check`, { method: "POST" }),
    onSuccess: (response) => {
      const name = response.obstacle.name ?? response.obstacle.structureType;
      const description = checkSummary(response);
      if (response.obstacle.status === "COMPLIANT") {
        toast.success(`${name} — ${t("status.COMPLIANT")}`, { description });
      } else {
        toast.warning(`${name} — ${t(`status.${response.obstacle.status}`)}`, { description });
      }
      queryClient.invalidateQueries({ queryKey: ["obstacles"] });
    },
    onError: (error: Error) => {
      toast.error("Compliance check failed", { description: error.message });
    },
  });

  const viewOnMap = React.useCallback((row: ObstacleRow) => {
    setFocused(row);
    setAirportFilter(row.airport.icao);
    setView("map");
  }, []);

  const columns = React.useMemo<ColumnDef<ObstacleRow, unknown>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => `${row.name ?? ""} ${row.structureType}`,
        header: "Structure",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-56">
            <p className="truncate font-medium">
              {row.original.name ?? row.original.structureType}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.structureType}
            </p>
          </div>
        ),
      },
      {
        id: "airport",
        accessorFn: (row) => row.airport.icao,
        header: t("common.airport"),
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono">
            {row.original.airport.icao}
          </Badge>
        ),
      },
      {
        id: "coords",
        enableSorting: false,
        header: t("application.coordinates"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
            {formatCoords(row.original.lat, row.original.lon)}
          </span>
        ),
      },
      {
        accessorKey: "topElevationAmslM",
        header: "Top (m AMSL)",
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">
            {formatMetres(row.original.topElevationAmslM)}
          </span>
        ),
      },
      {
        accessorKey: "heightAglM",
        header: "Height (m AGL)",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatMetres(row.original.heightAglM)}
          </span>
        ),
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => (
          <Badge variant="secondary" className="font-normal">
            {SOURCE_LABELS[row.original.source]}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: t("common.status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "linkedCase",
        accessorFn: (row) => row.linkedApplication?.refNo ?? "",
        header: "Linked case",
        cell: ({ row }) =>
          row.original.linkedApplication ? (
            <Link
              href={`/applications/${row.original.linkedApplication.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-xs text-primary hover:underline focus-visible:outline-2 rounded-sm"
            >
              {row.original.linkedApplication.refNo}
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "lastCheckedAt",
        header: "Last checked",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {row.original.lastCheckedAt ? timeAgo(row.original.lastCheckedAt) : "Never"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("common.actions")}</span>,
        enableSorting: false,
        size: 48,
        cell: ({ row }) => {
          const obstacle = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${t("common.actions")} — ${obstacle.name ?? obstacle.structureType}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuLabel className="max-w-52 truncate text-xs">
                  {obstacle.name ?? obstacle.structureType}
                </DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => viewOnMap(obstacle)}>
                  <MapPin aria-hidden />
                  View on map
                </DropdownMenuItem>
                {obstacle.linkedApplication && (
                  <DropdownMenuItem
                    onSelect={() =>
                      router.push(`/applications/${obstacle.linkedApplication!.id}`)
                    }
                  >
                    <Eye aria-hidden />
                    View linked case
                  </DropdownMenuItem>
                )}
                {canManage && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={checkMutation.isPending}
                      onSelect={() => checkMutation.mutate(obstacle.id)}
                    >
                      <ListChecks aria-hidden />
                      Re-check compliance
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setStatusRow(obstacle)}>
                      <ShieldAlert aria-hidden />
                      Set status
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [t, canManage, checkMutation, router, viewOnMap]
  );

  return (
    <PageTransition className="p-4 md:p-6">
      <PageHeader
        crumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("nav.obstacles") },
        ]}
        title={t("nav.obstacles")}
        description="Obstacle register — surveyed structures, certified obstacles and reported complaints near Bangladesh's airports."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/obstacles/monitoring">
                <MonitorDot className="size-4" aria-hidden />
                {t("nav.monitoring")}
              </Link>
            </Button>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn("size-4", isFetching && "animate-spin")} aria-hidden />
              {t("common.refresh")}
            </Button>
            {canManage && (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="size-4" aria-hidden />
                Add obstacle
              </Button>
            )}
          </>
        }
      />

      {/* KPI cards */}
      <SkeletonSwap
        loading={isLoading}
        skeleton={
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        }
      >
        <Stagger className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label={t("common.total")} value={stats?.total ?? 0} icon={Mountain} />
          <StatCard
            label={t("status.COMPLIANT")}
            value={stats?.compliant ?? 0}
            icon={ShieldCheck}
            tone="success"
          />
          <StatCard
            label={t("status.PENETRATING")}
            value={stats?.penetrating ?? 0}
            icon={AlertTriangle}
            tone="danger"
          />
          <StatCard
            label={t("status.UNDER_MONITORING")}
            value={stats?.monitoring ?? 0}
            icon={Activity}
            tone="warning"
          />
          <StatCard
            label={t("status.ILLEGAL")}
            value={stats?.illegal ?? 0}
            icon={ShieldAlert}
            tone="danger"
          />
        </Stagger>
      </SkeletonSwap>

      {/* View toggle */}
      <div
        className="mb-4 inline-flex rounded-lg border bg-muted/40 p-0.5"
        role="tablist"
        aria-label="Register view"
      >
        <Button
          role="tab"
          aria-selected={view === "table"}
          variant={view === "table" ? "secondary" : "ghost"}
          size="sm"
          className={cn(view === "table" && "shadow-sm")}
          onClick={() => setView("table")}
        >
          <Table2 className="size-4" aria-hidden />
          Table
        </Button>
        <Button
          role="tab"
          aria-selected={view === "map"}
          variant={view === "map" ? "secondary" : "ghost"}
          size="sm"
          className={cn(view === "map" && "shadow-sm")}
          onClick={() => {
            setFocused(null);
            setView("map");
          }}
        >
          <MapIcon className="size-4" aria-hidden />
          Map
        </Button>
      </div>

      {view === "map" ? (
        <ObstaclesMapView
          items={items}
          airports={airports}
          icao={airportFilter}
          onIcaoChange={(icao) => {
            setFocused(null);
            setAirportFilter(icao);
          }}
          focused={focused}
        />
      ) : (
        <DataTable<ObstacleRow>
          columns={columns}
          data={items}
          loading={isLoading}
          searchable
          searchPlaceholder={`${t("common.search")} — name, structure, case…`}
          initialSorting={[{ id: "status", desc: false }]}
          emptyTitle="No obstacles on the register"
          emptyDescription="Surveyed structures, certified obstacles and complaints appear here."
          emptyAction={
            canManage ? (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" aria-hidden />
                Add obstacle
              </Button>
            ) : undefined
          }
          toolbar={
            <>
              <Select value={airportFilter} onValueChange={setAirportFilter}>
                <SelectTrigger className="h-9 w-36" aria-label={t("common.airport")}>
                  <SelectValue placeholder={t("common.airport")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("common.all")} — {t("common.airport").toLowerCase()}s
                  </SelectItem>
                  {airports.map((airport) => (
                    <SelectItem key={airport.icao} value={airport.icao}>
                      {airport.icao} — {airport.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-40" aria-label={t("common.status")}>
                  <SelectValue placeholder={t("common.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("common.all")} — {t("common.status").toLowerCase()}
                  </SelectItem>
                  {OBSTACLE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`status.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="h-9 w-32" aria-label="Source">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")} — source</SelectItem>
                  {OBSTACLE_SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {SOURCE_LABELS[source]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={structureFilter} onValueChange={setStructureFilter}>
                <SelectTrigger className="h-9 w-40" aria-label={t("application.structureType")}>
                  <SelectValue placeholder={t("application.structureType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("common.all")} — {t("application.structureType").toLowerCase()}
                  </SelectItem>
                  {structureTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
          exportCsv={{
            filename: "caab-obstacle-register.csv",
            headers: [
              "Name",
              "Structure Type",
              "Airport",
              "Latitude",
              "Longitude",
              "Top Elevation (m AMSL)",
              "Height (m AGL)",
              "Source",
              "Status",
              "Linked Case",
              "Last Checked",
              "Remarks",
            ],
            row: (item) => [
              item.name ?? "",
              item.structureType,
              item.airport.icao,
              item.lat.toFixed(6),
              item.lon.toFixed(6),
              item.topElevationAmslM.toFixed(2),
              item.heightAglM != null ? item.heightAglM.toFixed(2) : "",
              SOURCE_LABELS[item.source],
              item.status,
              item.linkedApplication?.refNo ?? "",
              item.lastCheckedAt ?? "",
              item.remarks ?? "",
            ],
          }}
        />
      )}

      {/* Dialogs */}
      <AddObstacleDialog open={addOpen} onOpenChange={setAddOpen} airports={airports} />
      <SetStatusDialog obstacle={statusRow} onOpenChange={(open) => !open && setStatusRow(null)} />
    </PageTransition>
  );
}
