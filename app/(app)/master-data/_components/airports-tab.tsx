"use client";

// Master data → Airports tab: DataTable of airports; row → Airport editor Sheet.
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Layers, Plus, Radio, SlidersHorizontal } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/providers";
import { formatMetres } from "@/lib/format";
import { fetchJson, FRAMEWORK_LABELS, type AirportListItem } from "./types";
import { AirportCreateDialog } from "./airport-create-dialog";
import { AirportEditorSheet } from "./airport-editor-sheet";

export function AirportsTab() {
  const t = useT();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["md-airports"],
    queryFn: () => fetchJson<{ items: AirportListItem[] }>("/api/master-data/airports"),
  });
  const items = data?.items ?? [];

  const columns = React.useMemo<ColumnDef<AirportListItem, unknown>[]>(
    () => [
      {
        accessorKey: "icao",
        header: "ICAO",
        cell: ({ row }) => <Badge variant="outline" className="font-mono">{row.original.icao}</Badge>,
      },
      {
        accessorKey: "iata",
        header: "IATA",
        cell: ({ row }) =>
          row.original.iata ? (
            <span className="font-mono text-xs">{row.original.iata}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "name",
        header: t("common.airport"),
        cell: ({ row }) => (
          <div className="min-w-0 max-w-64">
            <p className="truncate font-medium">{row.original.name}</p>
            {row.original.nameBn && (
              <p className="truncate text-xs text-muted-foreground">{row.original.nameBn}</p>
            )}
          </div>
        ),
      },
      { accessorKey: "city", header: "City" },
      {
        accessorKey: "elevationM",
        header: "Elevation",
        cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatMetres(row.original.elevationM, 1)}</span>,
      },
      {
        id: "runwayCount",
        accessorFn: (r) => r.runwayCount,
        header: "Runways",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Layers className="size-3.5 text-muted-foreground" aria-hidden />
            {row.original.runwayCount}
          </span>
        ),
      },
      {
        id: "navaidCount",
        accessorFn: (r) => r.navaidCount,
        header: "Navaids",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Radio className="size-3.5 text-muted-foreground" aria-hidden />
            {row.original.navaidCount}
          </span>
        ),
      },
      {
        id: "ols",
        accessorFn: (r) => r.activeOlsVersion ?? 0,
        header: "OLS params",
        cell: ({ row }) =>
          row.original.activeOlsVersion != null ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
              <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="font-medium">v{row.original.activeOlsVersion}</span>
              {row.original.activeOlsFramework && (
                <span className="text-muted-foreground">
                  · {FRAMEWORK_LABELS[row.original.activeOlsFramework]}
                </span>
              )}
            </span>
          ) : (
            <Badge variant="secondary" className="font-normal">Defaults</Badge>
          ),
      },
      {
        accessorKey: "active",
        header: t("common.status"),
        cell: ({ row }) => <StatusBadge status={row.original.active ? "COMPLIANT" : "EXPIRED"} showDot={false} />,
      },
    ],
    [t]
  );

  return (
    <>
      <DataTable<AirportListItem>
        columns={columns}
        data={items}
        loading={isLoading}
        searchable
        searchPlaceholder="Search airports — ICAO, name, city…"
        initialSorting={[{ id: "icao", desc: false }]}
        onRowClick={(row) => setEditingId(row.id)}
        emptyTitle="No airports"
        emptyDescription="Add an aerodrome to define its runways, navaids and OLS parameters."
        emptyAction={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Add airport
          </Button>
        }
        toolbar={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Add airport
          </Button>
        }
        exportCsv={{
          filename: "caab-airports.csv",
          headers: ["ICAO", "IATA", "Name", "City", "Elevation (m)", "Lat", "Lon", "Runways", "Navaids", "Active OLS version", "Active"],
          row: (i) => [
            i.icao,
            i.iata ?? "",
            i.name,
            i.city,
            i.elevationM,
            i.referenceLat.toFixed(6),
            i.referenceLon.toFixed(6),
            i.runwayCount,
            i.navaidCount,
            i.activeOlsVersion ?? "",
            i.active ? "Yes" : "No",
          ],
        }}
      />

      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="size-3.5" aria-hidden />
        Select a row to edit runways, navaids and OLS parameters.
      </p>

      <AirportCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AirportEditorSheet airportId={editingId} onOpenChange={(o) => !o && setEditingId(null)} />
    </>
  );
}
