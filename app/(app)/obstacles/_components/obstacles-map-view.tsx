"use client";

// Register map view: status-coloured obstacle markers over the selected
// airport's OLS surface footprints, with both legends.
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type * as GeoJSON from "geojson";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { OlsMap, OlsLegend } from "@/components/map/ols-map";
import { FadeIn } from "@/components/motion";
import { useT } from "@/components/providers";
import {
  fetchJson,
  OBSTACLE_STATUSES,
  type AirportOption,
  type ObstacleRow,
} from "./types";

const DEFAULT_CENTER: [number, number] = [90.3978, 23.8433]; // Dhaka

// Mirrors OBSTACLE_COLORS in components/map/ols-map.tsx (not exported there).
const STATUS_CHIP_COLORS: Record<string, string> = {
  COMPLIANT: "#1a7f4b",
  PENETRATING: "#b3261e",
  UNDER_MONITORING: "#9a6a00",
  ILLEGAL: "#b3261e",
};

interface OlsPayload {
  airport: {
    icao: string;
    name: string;
    referenceLat: number;
    referenceLon: number;
  };
  surfaces: GeoJSON.FeatureCollection;
  runways: GeoJSON.FeatureCollection;
  navaids: Array<{ id: string; type: string; name: string | null; lat: number; lon: number }>;
}

export function ObstaclesMapView({
  items,
  airports,
  icao,
  onIcaoChange,
  focused,
}: {
  items: ObstacleRow[];
  airports: AirportOption[];
  /** ICAO of the airport whose surfaces are overlaid; "all" hides the overlay. */
  icao: string;
  onIcaoChange: (icao: string) => void;
  /** Obstacle to centre on (from the "View on map" row action). */
  focused: ObstacleRow | null;
}) {
  const t = useT();

  const olsQ = useQuery({
    queryKey: ["airport-ols", icao],
    enabled: icao !== "all",
    staleTime: 10 * 60_000,
    queryFn: () => fetchJson<OlsPayload>(`/api/airports/${icao}/ols`),
  });

  React.useEffect(() => {
    if (olsQ.error) {
      toast.error("Could not load OLS surfaces", {
        description: (olsQ.error as Error).message,
      });
    }
  }, [olsQ.error]);

  const selectedAirport = airports.find((a) => a.icao === icao) ?? null;
  const center: [number, number] = focused
    ? [focused.lon, focused.lat]
    : selectedAirport
      ? [selectedAirport.referenceLon, selectedAirport.referenceLat]
      : items[0]
        ? [items[0].lon, items[0].lat]
        : DEFAULT_CENTER;

  const markers = React.useMemo(
    () =>
      items.map((o) => ({
        lat: o.lat,
        lon: o.lon,
        status: o.status,
        label: `${o.name ?? o.structureType} — ${t(`status.${o.status}`)} (${o.topElevationAmslM.toFixed(1)} m AMSL)`,
      })),
    [items, t]
  );

  return (
    <FadeIn>
      <Card className="overflow-hidden py-0 gap-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Select value={icao} onValueChange={onIcaoChange}>
            <SelectTrigger className="h-9 w-56" aria-label={t("common.airport")}>
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
          {icao === "all" && (
            <p className="text-xs text-muted-foreground">
              Select an airport to overlay its OLS surfaces.
            </p>
          )}
          {olsQ.isFetching && <Skeleton className="h-4 w-28" aria-hidden />}
        </div>

        <div className="relative">
          <OlsMap
            center={center}
            zoom={focused ? 13 : 11.2}
            surfaces={icao !== "all" ? olsQ.data?.surfaces ?? null : null}
            runways={icao !== "all" ? olsQ.data?.runways ?? null : null}
            navaids={icao !== "all" ? olsQ.data?.navaids ?? [] : []}
            obstacles={markers}
            site={focused ? { lat: focused.lat, lon: focused.lon } : null}
            siteStatus={
              focused
                ? focused.status === "COMPLIANT"
                  ? "CLEAR"
                  : focused.status === "UNDER_MONITORING"
                    ? "NONE"
                    : "OBJECTION"
                : "NONE"
            }
            className="h-[520px] w-full"
          />
        </div>

        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t p-3">
          <OlsLegend />
          <ul
            className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
            aria-label="Obstacle status legend"
          >
            {OBSTACLE_STATUSES.map((status) => (
              <li key={status} className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-full border border-white/60"
                  style={{ background: STATUS_CHIP_COLORS[status] }}
                  aria-hidden
                />
                {t(`status.${status}`)}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </FadeIn>
  );
}
