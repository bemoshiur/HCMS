"use client";

/**
 * Public obstacle register — filterable DataTable over GET /api/public-register
 * with an optional map view (coloured obstacle markers by status).
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FilterX, Map as MapIcon, MapPinned, TableProperties } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { OlsMap } from "@/components/map/ols-map";
import { PageTransition, Collapse, FadeIn } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/components/providers";
import { formatDate, toDMS } from "@/lib/format";

// ─────────────────────────── contracts ───────────────────────────

interface RegisterItem {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  topElevationAmslM: number;
  heightAglM: number | null;
  structureType: string;
  status: "COMPLIANT" | "PENETRATING" | "UNDER_MONITORING" | "ILLEGAL";
  source: "CERTIFIED" | "SURVEY" | "COMPLAINT";
  lastCheckedAt: string | null;
  createdAt: string;
  airport: { icao: string; name: string };
}

interface RegisterResponse {
  items: RegisterItem[];
  total: number;
}

interface AirportListItem {
  icao: string;
  name: string;
  city: string;
  referenceLat: number;
  referenceLon: number;
}

const OBSTACLE_STATUSES = ["COMPLIANT", "PENETRATING", "UNDER_MONITORING", "ILLEGAL"] as const;
const ALL = "all";

// ─────────────────────────── component ───────────────────────────

export function RegisterClient() {
  const t = useT();
  const [icao, setIcao] = React.useState(ALL);
  const [structureType, setStructureType] = React.useState(ALL);
  const [status, setStatus] = React.useState(ALL);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [showMap, setShowMap] = React.useState(false);

  const airportsQuery = useQuery<AirportListItem[]>({
    queryKey: ["airports"],
    queryFn: async () => {
      const res = await fetch("/api/airports");
      if (!res.ok) throw new Error("Failed to load airports");
      return res.json();
    },
  });

  // Unfiltered fetch once → stable structure-type options.
  const optionsQuery = useQuery<RegisterResponse>({
    queryKey: ["public-register", "options"],
    queryFn: async () => {
      const res = await fetch("/api/public-register");
      if (!res.ok) throw new Error("Failed to load register");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const structureTypes = React.useMemo(
    () =>
      Array.from(new Set((optionsQuery.data?.items ?? []).map((i) => i.structureType))).sort(),
    [optionsQuery.data]
  );

  const params = new URLSearchParams();
  if (icao !== ALL) params.set("icao", icao);
  if (structureType !== ALL) params.set("structureType", structureType);
  if (status !== ALL) params.set("status", status);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const queryString = params.toString();

  const registerQuery = useQuery<RegisterResponse>({
    queryKey: ["public-register", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/public-register${queryString ? `?${queryString}` : ""}`);
      if (!res.ok) throw new Error("Failed to load register");
      return res.json();
    },
  });

  const items = registerQuery.data?.items ?? [];
  const hasFilters = icao !== ALL || structureType !== ALL || status !== ALL || !!from || !!to;
  const clearFilters = () => {
    setIcao(ALL);
    setStructureType(ALL);
    setStatus(ALL);
    setFrom("");
    setTo("");
  };

  const selectedAirport = airportsQuery.data?.find((a) => a.icao === icao) ?? null;
  const mapCenter: [number, number] = selectedAirport
    ? [selectedAirport.referenceLon, selectedAirport.referenceLat]
    : [90.3, 23.8];
  const mapZoom = selectedAirport ? 11 : 6.3;

  const columns = React.useMemo<ColumnDef<RegisterItem, unknown>[]>(
    () => [
      {
        id: "airport",
        header: t("common.airport"),
        accessorFn: (row) => row.airport.icao,
        cell: ({ row }) => (
          <div className="leading-tight">
            <span className="font-mono text-xs font-semibold text-primary">
              {row.original.airport.icao}
            </span>
            <p className="max-w-[160px] truncate text-xs text-muted-foreground">
              {row.original.airport.name}
            </p>
          </div>
        ),
      },
      {
        id: "name",
        header: "Structure",
        accessorFn: (row) => row.name ?? "",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name ?? "—"}</span>
        ),
      },
      {
        id: "structureType",
        header: t("application.structureType"),
        accessorFn: (row) => row.structureType,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.structureType}</span>
        ),
      },
      {
        id: "status",
        header: t("common.status"),
        accessorFn: (row) => row.status,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "topElevation",
        header: "Top elev. (m AMSL)",
        accessorFn: (row) => row.topElevationAmslM,
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.topElevationAmslM.toFixed(1)}</span>
        ),
      },
      {
        id: "heightAgl",
        header: "Height (m AGL)",
        accessorFn: (row) => row.heightAglM ?? -1,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.heightAglM != null ? row.original.heightAglM.toFixed(1) : "—"}
          </span>
        ),
      },
      {
        id: "coordinates",
        header: t("application.coordinates"),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
            {toDMS(row.original.lat, "lat")} {toDMS(row.original.lon, "lon")}
          </span>
        ),
      },
      {
        id: "source",
        header: "Source",
        accessorFn: (row) => row.source,
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[10px]">
            {row.original.source}
          </Badge>
        ),
      },
      {
        id: "recorded",
        header: t("common.date"),
        accessorFn: (row) => row.createdAt,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [t]
  );

  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <PageHeader
          crumbs={[{ label: t("nav.home"), href: "/" }, { label: t("nav.publicRegister") }]}
          title={t("public.registerTitle")}
          description={t("public.registerSubtitle")}
          actions={
            <Button
              variant="outline"
              onClick={() => setShowMap((v) => !v)}
              aria-pressed={showMap}
            >
              {showMap ? (
                <TableProperties className="size-4" aria-hidden />
              ) : (
                <MapIcon className="size-4" aria-hidden />
              )}
              {showMap ? "Hide map" : "Map view"}
            </Button>
          }
        />

        {/* Map view */}
        <Collapse open={showMap} className="mb-6">
          <Card className="gap-0 overflow-hidden p-0">
            <OlsMap
              center={mapCenter}
              zoom={mapZoom}
              obstacles={items.map((item) => ({
                lat: item.lat,
                lon: item.lon,
                status: item.status,
                label: `${item.name ?? item.structureType} — ${item.topElevationAmslM.toFixed(1)} m AMSL`,
              }))}
              className="h-[420px] w-full"
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2.5">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPinned className="size-3.5" aria-hidden />
                {items.length} {t("common.rows")}
              </span>
              {OBSTACLE_STATUSES.map((s) => (
                <span key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    aria-hidden
                    className="inline-block size-2.5 rounded-full"
                    style={{
                      background:
                        s === "COMPLIANT"
                          ? "#1a7f4b"
                          : s === "UNDER_MONITORING"
                            ? "#9a6a00"
                            : "#b3261e",
                    }}
                  />
                  {t(`status.${s}`)}
                </span>
              ))}
            </div>
          </Card>
        </Collapse>

        {/* Table */}
        <FadeIn>
          <DataTable<RegisterItem>
            columns={columns}
            data={items}
            loading={registerQuery.isLoading}
            searchable
            searchPlaceholder={`${t("common.search")}…`}
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <Select value={icao} onValueChange={setIcao}>
                  <SelectTrigger className="h-9 w-[150px]" aria-label={t("common.airport")}>
                    <SelectValue placeholder={t("common.airport")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>
                      {t("common.all")} — {t("common.airport")}
                    </SelectItem>
                    {(airportsQuery.data ?? []).map((airport) => (
                      <SelectItem key={airport.icao} value={airport.icao}>
                        {airport.icao} · {airport.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={structureType} onValueChange={setStructureType}>
                  <SelectTrigger
                    className="h-9 w-[190px]"
                    aria-label={t("application.structureType")}
                  >
                    <SelectValue placeholder={t("application.structureType")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>
                      {t("common.all")} — {t("application.structureType")}
                    </SelectItem>
                    {structureTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9 w-[170px]" aria-label={t("common.status")}>
                    <SelectValue placeholder={t("common.status")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>
                      {t("common.all")} — {t("common.status")}
                    </SelectItem>
                    {OBSTACLE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`status.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1.5">
                  <Label htmlFor="register-from" className="sr-only">
                    {t("common.from")}
                  </Label>
                  <Input
                    id="register-from"
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-9 w-[140px]"
                    aria-label={t("common.from")}
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Label htmlFor="register-to" className="sr-only">
                    {t("common.to")}
                  </Label>
                  <Input
                    id="register-to"
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-9 w-[140px]"
                    aria-label={t("common.to")}
                  />
                </div>

                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <FilterX className="size-4" aria-hidden />
                    {t("common.clearFilters")}
                  </Button>
                )}
              </div>
            }
            exportCsv={{
              filename: "caab-public-obstacle-register.csv",
              headers: [
                "Airport",
                "Structure",
                "Structure type",
                "Status",
                "Top elevation (m AMSL)",
                "Height (m AGL)",
                "Latitude",
                "Longitude",
                "Source",
                "Recorded",
              ],
              row: (item) => [
                item.airport.icao,
                item.name ?? "",
                item.structureType,
                item.status,
                item.topElevationAmslM,
                item.heightAglM ?? "",
                item.lat,
                item.lon,
                item.source,
                formatDate(item.createdAt),
              ],
            }}
            emptyTitle={t("common.noResults")}
            emptyDescription="No register entries match the current filters."
            emptyAction={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  {t("common.clearFilters")}
                </Button>
              ) : undefined
            }
            initialSorting={[{ id: "recorded", desc: true }]}
            pageSize={10}
          />
        </FadeIn>
      </div>
    </PageTransition>
  );
}
