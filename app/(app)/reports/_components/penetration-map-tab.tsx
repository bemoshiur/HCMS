"use client";

/**
 * Penetration Map tab — OLS surfaces of the selected airport with red markers
 * for every penetrating proposal (latest evaluation per application, from
 * GET /api/reports/analytics), plus a side list sorted by penetration depth.
 */
import * as React from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { OlsMap, OlsLegend } from "@/components/map/ols-map";
import { useT } from "@/components/providers";
import { formatMetres } from "@/lib/format";
import {
  analyticsQueryString,
  fetchJson,
  type AirportOption,
  type AnalyticsResponse,
  type OlsPayload,
} from "./types";

const DEFAULT_CENTER: [number, number] = [90.3978, 23.8433]; // Dhaka

export function PenetrationMapTab() {
  const t = useT();
  const [icao, setIcao] = React.useState<string | null>(null);

  const airportsQ = useQuery({
    queryKey: ["airports"],
    queryFn: () => fetchJson<AirportOption[]>("/api/airports"),
    staleTime: 10 * 60_000,
  });

  // Default airport once the list arrives.
  React.useEffect(() => {
    if (icao || !airportsQ.data?.length) return;
    const preferred = airportsQ.data.find((a) => a.icao === "VGHS") ?? airportsQ.data[0];
    setIcao(preferred.icao);
  }, [icao, airportsQ.data]);

  const olsQ = useQuery({
    queryKey: ["airport-ols", icao],
    enabled: !!icao,
    queryFn: () => fetchJson<OlsPayload>(`/api/airports/${icao}/ols`),
    staleTime: 10 * 60_000,
  });

  const analyticsQ = useQuery({
    queryKey: ["reports-analytics", icao ?? "", "", ""],
    enabled: !!icao,
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchJson<AnalyticsResponse>(
        `/api/reports/analytics${analyticsQueryString({ icao: icao ?? "", from: "", to: "" })}`
      ),
  });

  const selectedAirport = React.useMemo(
    () => airportsQ.data?.find((a) => a.icao === icao) ?? null,
    [airportsQ.data, icao]
  );
  const center = React.useMemo<[number, number]>(
    () =>
      selectedAirport
        ? [selectedAirport.referenceLon, selectedAirport.referenceLat]
        : DEFAULT_CENTER,
    [selectedAirport]
  );

  const penetrations = React.useMemo(
    () =>
      (analyticsQ.data?.penetrationMap ?? [])
        .filter((p) => !icao || p.icao === icao)
        .sort((a, b) => b.penetrationM - a.penetrationM),
    [analyticsQ.data, icao]
  );

  const markers = React.useMemo(
    () =>
      penetrations.map((p) => ({
        lat: p.lat,
        lon: p.lon,
        status: "PENETRATING", // fixed red marker
        label: `${p.refNo} — penetration ${formatMetres(p.penetrationM)}`,
      })),
    [penetrations]
  );

  const loading = analyticsQ.isLoading || (olsQ.isLoading && !!icao);

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-lg border bg-card px-3 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <Label htmlFor="pen-airport" className="text-xs font-medium text-muted-foreground">
            {t("common.airport")}
          </Label>
          <Select
            value={icao ?? ""}
            onValueChange={(v) => v && setIcao(v)}
            disabled={airportsQ.isLoading}
          >
            <SelectTrigger id="pen-airport" className="w-52 md:w-72">
              <SelectValue
                placeholder={airportsQ.isLoading ? t("common.loading") : "Select airport"}
              />
            </SelectTrigger>
            <SelectContent>
              {(airportsQ.data ?? []).map((a) => (
                <SelectItem key={a.icao} value={a.icao}>
                  {a.icao} — {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {analyticsQ.isFetching && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
        )}
        <OlsLegend className="w-full md:ml-auto md:w-auto" />
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
        <div className="flex flex-col gap-4 lg:h-[calc(100dvh-21rem)] lg:min-h-[480px] lg:flex-row">
          {/* ── Map ── */}
          <div className="relative min-h-[380px] flex-1 overflow-hidden rounded-xl border bg-muted shadow-sm lg:min-h-0">
            <OlsMap
              center={center}
              zoom={11}
              surfaces={olsQ.data?.surfaces ?? null}
              runways={olsQ.data?.runways ?? null}
              navaids={olsQ.data?.navaids ?? []}
              obstacles={markers}
              className="absolute inset-0 h-full w-full"
            />
            {loading && icao && (
              <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md border bg-background/90 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {t("common.loading")}
              </div>
            )}
            {!loading && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
                {penetrations.length.toLocaleString("en-US")} penetrating proposal
                {penetrations.length === 1 ? "" : "s"} at {icao ?? "—"}
              </div>
            )}
          </div>

          {/* ── Side panel: penetrating cases sorted by depth ── */}
          <aside className="flex w-full shrink-0 flex-col lg:min-h-0 lg:w-[360px] xl:w-[400px]">
            <Card className="flex min-h-0 flex-1 flex-col gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-sm font-medium">
                  Penetrating proposals
                  {penetrations.length > 0 && (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      ({penetrations.length.toLocaleString("en-US")})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto px-4">
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : penetrations.length === 0 ? (
                  <EmptyState
                    icon={ShieldCheck}
                    title="No penetrations recorded"
                    description="No evaluated proposal penetrates the obstacle limitation surfaces of this airport."
                    className="border-0 py-10"
                  />
                ) : (
                  <ul className="space-y-2">
                    {penetrations.map((p) => (
                      <li key={p.applicationId}>
                        <Link
                          href={`/applications/${p.applicationId}`}
                          className="group flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent focus-visible:outline-2"
                        >
                          <span className="min-w-0">
                            <span className="flex items-center gap-1 text-sm font-medium text-primary">
                              {p.refNo}
                              <ArrowUpRight
                                className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                                aria-hidden
                              />
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {p.icao} · {p.lat.toFixed(4)}, {p.lon.toFixed(4)}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full border border-destructive/25 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-destructive">
                            +{formatMetres(p.penetrationM)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
