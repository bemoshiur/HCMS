"use client";

/**
 * OLS evaluation screen (map-centric, brief §17).
 * Near-full-height layout: map dominates; right-side result panel (stacks
 * below the map and collapses on mobile). Live re-evaluation (400 ms
 * debounce) on marker drag / map click / input change via POST /api/evaluate.
 */
import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpRight,
  ChevronDown,
  Download,
  FileSearch,
  Info,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import type * as GeoJSON from "geojson";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { PageTransition } from "@/components/motion";
import { OlsMap, OlsLegend, type SiteStatus } from "@/components/map/ols-map";
import { useT } from "@/components/providers";
import { cn } from "@/lib/utils";

import { SiteInputsCard } from "./site-inputs-card";
import { ResultPanel } from "./result-panel";
import {
  siteSchema,
  fetchJson,
  postEvaluate,
  round6,
  type AirportListItem,
  type ApplicationPrefill,
  type EvaluateResponse,
  type OlsPayload,
  type SiteFormValues,
} from "./types";

const DEFAULT_CENTER: [number, number] = [90.3978, 23.8433]; // Dhaka

export function EvaluateScreen({ applicationId }: { applicationId: string | null }) {
  const t = useT();

  // ───────────────────────────── local state ─────────────────────────────
  const [icao, setIcao] = React.useState<string | null>(null);
  const [site, setSite] = React.useState<{ lat: number; lon: number } | null>(null);
  const [showZoning, setShowZoning] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(true);
  const [evalInput, setEvalInput] = React.useState<SiteFormValues | null>(null);

  // ─────────────────────────────── form ───────────────────────────────
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteSchema),
    mode: "onChange",
    defaultValues: { requestedHeightAglM: 45 },
  });

  // ─────────────────────────────── queries ───────────────────────────────
  const airportsQ = useQuery({
    queryKey: ["airports"],
    queryFn: () => fetchJson<AirportListItem[]>("/api/airports"),
    staleTime: 10 * 60_000,
  });

  const olsQ = useQuery({
    queryKey: ["airport-ols", icao],
    enabled: !!icao,
    queryFn: () => fetchJson<OlsPayload>(`/api/airports/${icao}/ols`),
    staleTime: 10 * 60_000,
  });

  // Zoning grid — fetched lazily, only once the toggle is first enabled.
  const zoningQ = useQuery({
    queryKey: ["airport-zoning", icao],
    enabled: !!icao && showZoning,
    queryFn: () => fetchJson<GeoJSON.FeatureCollection>(`/api/airports/${icao}/zoning`),
    staleTime: Infinity,
  });

  // Deep link ?app=<id> — prefill from the application (ignore failures).
  const appQ = useQuery({
    queryKey: ["evaluate-prefill", applicationId],
    enabled: !!applicationId,
    retry: false,
    queryFn: () => fetchJson<ApplicationPrefill>(`/api/applications/${applicationId}`),
  });

  const evalQ = useQuery({
    queryKey: [
      "evaluate",
      icao,
      evalInput?.lat,
      evalInput?.lon,
      evalInput?.groundElevationM,
      evalInput?.requestedHeightAglM,
    ],
    enabled: !!icao && !!evalInput,
    placeholderData: keepPreviousData,
    retry: 1,
    queryFn: () => {
      if (!icao || !evalInput) return Promise.reject(new Error("Missing input"));
      return postEvaluate(icao, evalInput);
    },
  });

  // ───────────────────────────── derived state ─────────────────────────────
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

  const result = (evalQ.data as EvaluateResponse | undefined)?.result ?? null;
  const siteStatus: SiteStatus = site ? (result?.status ?? "NONE") : "NONE";
  const evaluating = !!site && (evalQ.isLoading || !evalInput);
  const refreshing = evalQ.isFetching && !evalQ.isLoading;

  // ───────────────────────────── effects ─────────────────────────────

  // Deep-link prefill (runs once when the application loads).
  const prefilledRef = React.useRef(false);
  React.useEffect(() => {
    const app = appQ.data;
    if (!app || prefilledRef.current) return;
    if (
      typeof app.lat !== "number" ||
      typeof app.lon !== "number" ||
      !app.airport?.icao
    ) {
      return;
    }
    prefilledRef.current = true;
    const values: SiteFormValues = {
      lat: round6(app.lat),
      lon: round6(app.lon),
      groundElevationM:
        typeof app.groundElevationM === "number" ? app.groundElevationM : 0,
      requestedHeightAglM:
        typeof app.requestedHeightAglM === "number" ? app.requestedHeightAglM : 45,
    };
    setIcao(app.airport.icao);
    form.reset(values);
    setSite({ lat: values.lat, lon: values.lon });
    setEvalInput(values); // evaluate immediately — no debounce for prefill
  }, [appQ.data, form]);

  // Default airport once the list arrives (deep link takes precedence).
  React.useEffect(() => {
    if (icao || !airportsQ.data?.length) return;
    if (applicationId && !appQ.isError && !appQ.isSuccess) return; // wait for prefill
    if (applicationId && appQ.isSuccess) return; // prefill effect owns selection
    const preferred =
      airportsQ.data.find((a) => a.icao === "VGHS") ?? airportsQ.data[0];
    setIcao(preferred.icao);
    // Seed a default site ~2 km NE of the reference point so the screen shows a
    // live evaluation immediately (the brief wants a live result, not a blank
    // panel). The debounced effect below picks these up and drops the marker.
    const currentLat = form.getValues("lat");
    if (currentLat == null || Number.isNaN(currentLat)) {
      form.setValue("lat", round6(preferred.referenceLat + 0.014), { shouldValidate: true });
      form.setValue("lon", round6(preferred.referenceLon + 0.014), { shouldValidate: true });
    }
    const current = form.getValues("groundElevationM");
    if (current == null || Number.isNaN(current)) {
      form.setValue("groundElevationM", preferred.elevationM, {
        shouldValidate: true,
      });
    }
  }, [icao, airportsQ.data, applicationId, appQ.isError, appQ.isSuccess, form]);

  // Debounced live evaluation: any valid form change → marker + POST /api/evaluate.
  const watched = form.watch();
  const watchKey = `${watched.lat}|${watched.lon}|${watched.groundElevationM}|${watched.requestedHeightAglM}`;
  React.useEffect(() => {
    const parsed = siteSchema.safeParse(form.getValues());
    if (!parsed.success) return;
    const timer = setTimeout(() => {
      setSite({ lat: parsed.data.lat, lon: parsed.data.lon });
      setEvalInput(parsed.data);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchKey]);

  // Surface fetch/eval errors as toasts (once per error instance).
  const evalError = (evalQ.error as Error | null) ?? null;
  React.useEffect(() => {
    if (evalError) {
      toast.error("Evaluation failed", { description: evalError.message });
    }
  }, [evalError]);

  const zoningError = (zoningQ.error as Error | null) ?? null;
  React.useEffect(() => {
    if (zoningError) {
      toast.error("Could not load the zoning grid", {
        description: zoningError.message,
      });
    }
  }, [zoningError]);

  const olsError = (olsQ.error as Error | null) ?? null;
  React.useEffect(() => {
    if (olsError) {
      toast.error("Could not load OLS surfaces", { description: olsError.message });
    }
  }, [olsError]);

  // ───────────────────────────── handlers ─────────────────────────────

  // Map click / marker drag → sync coordinates into the form (marker moves
  // instantly; the debounce effect then re-evaluates).
  const applySite = React.useCallback(
    (pos: { lat: number; lon: number }) => {
      const lat = round6(pos.lat);
      const lon = round6(pos.lon);
      setSite({ lat, lon });
      form.setValue("lat", lat, { shouldValidate: true, shouldDirty: true });
      form.setValue("lon", lon, { shouldValidate: true, shouldDirty: true });
    },
    [form]
  );

  function handleAirportChange(next: string) {
    if (!next || next === icao) return;
    setIcao(next);
    setSite(null);
    setEvalInput(null);
    const airport = airportsQ.data?.find((a) => a.icao === next);
    const keepHeight = form.getValues("requestedHeightAglM");
    form.reset({
      lat: undefined,
      lon: undefined,
      groundElevationM: airport?.elevationM,
      requestedHeightAglM:
        keepHeight != null && !Number.isNaN(keepHeight) ? keepHeight : 45,
    });
  }

  function handleDownloadGrid() {
    if (!icao) return;
    window.open(`/api/airports/${icao}/zoning?download=1`, "_blank", "noopener");
    toast.success("Zoning grid download started", {
      description: `${icao}-zoning-grid.geojson`,
    });
  }

  // ───────────────────────────── render ─────────────────────────────

  const paramSetVersion = olsQ.data?.airport.paramSetVersion ?? null;

  const appChip = appQ.data ? (
    <Link
      href={`/applications/${appQ.data.id}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-info/30 bg-info/10 px-3 py-1 text-xs font-medium text-info transition-colors hover:bg-info/20 focus-visible:outline-2"
    >
      <FileSearch className="size-3.5" aria-hidden />
      Evaluating application {appQ.data.refNo}
      <ArrowUpRight className="size-3" aria-hidden />
    </Link>
  ) : undefined;

  return (
    <PageTransition>
      <PageHeader
        className="mb-4"
        crumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("nav.evaluate") },
        ]}
        title="OLS Evaluation"
        actions={appChip}
      />

      {/* ── Toolbar ── */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-lg border bg-card px-3 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <Label
            htmlFor="eval-airport"
            className="text-xs font-medium text-muted-foreground"
          >
            {t("common.airport")}
          </Label>
          <Select
            value={icao ?? ""}
            onValueChange={handleAirportChange}
            disabled={airportsQ.isLoading}
          >
            <SelectTrigger id="eval-airport" className="w-52 md:w-72">
              <SelectValue
                placeholder={
                  airportsQ.isLoading ? t("common.loading") : "Select airport"
                }
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

        <div className="flex items-center gap-2">
          <Switch
            id="eval-zoning"
            checked={showZoning}
            onCheckedChange={setShowZoning}
          />
          <Label htmlFor="eval-zoning" className="text-sm">
            Zoning grid
          </Label>
          {zoningQ.isFetching && (
            <Loader2
              className="size-3.5 animate-spin text-muted-foreground"
              aria-hidden
            />
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownloadGrid}
          disabled={!icao}
        >
          <Download aria-hidden />
          Download grid (GeoJSON)
        </Button>

        <OlsLegend className="w-full md:ml-auto md:w-auto" />

        {olsQ.data && (
          <p className="flex basis-full items-center gap-1.5 text-[11px] text-muted-foreground">
            <Info className="size-3 shrink-0" aria-hidden />
            {paramSetVersion != null
              ? `OLS parameter set v${paramSetVersion} — reference, confirm against CAAB AIP`
              : "OLS default parameter set (Annex 14, Code 3/4) — reference, confirm against CAAB AIP"}
          </p>
        )}
      </div>

      {/* ── Map + panel (near-full-height on desktop, stacked on mobile) ── */}
      <div className="flex flex-col gap-4 lg:h-[calc(100dvh-16.5rem)] lg:min-h-[520px] lg:flex-row">
        {/* Map */}
        <div className="relative min-h-[380px] flex-1 overflow-hidden rounded-xl border bg-muted shadow-sm lg:min-h-0">
          <OlsMap
            center={center}
            zoom={11.5}
            surfaces={olsQ.data?.surfaces ?? null}
            runways={olsQ.data?.runways ?? null}
            navaids={olsQ.data?.navaids ?? []}
            zoningGrid={zoningQ.data ?? null}
            showZoning={showZoning && !!zoningQ.data}
            site={site}
            siteStatus={siteStatus}
            siteDraggable
            onSiteChange={applySite}
            onMapClick={applySite}
            className="absolute inset-0 h-full w-full"
          />
          {olsQ.isLoading && icao && (
            <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md border bg-background/90 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Loading surfaces…
            </div>
          )}
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-full border bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur sm:block">
            Click the map to set the site · drag the marker to move it
          </div>
        </div>

        {/* Panel */}
        <aside className="flex w-full shrink-0 flex-col lg:min-h-0 lg:w-[400px] xl:w-[430px]">
          <button
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            aria-expanded={panelOpen}
            aria-controls="eval-panel"
            className="mb-3 flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent focus-visible:outline-2 lg:hidden"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal
                className="size-4 text-muted-foreground"
                aria-hidden
              />
              {t("application.site")} &amp; {t("application.evaluation").toLowerCase()}
            </span>
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-200",
                panelOpen && "rotate-180"
              )}
              aria-hidden
            />
          </button>
          <div
            id="eval-panel"
            className={cn(
              "min-h-0 flex-1 flex-col gap-4 lg:flex lg:overflow-y-auto lg:pr-1",
              panelOpen ? "flex" : "hidden lg:flex"
            )}
          >
            <SiteInputsCard form={form} />
            <ResultPanel
              result={result}
              hasSite={!!site}
              evaluating={evaluating}
              refreshing={refreshing}
              error={evalError}
              onRetry={() => evalQ.refetch()}
            />
          </div>
        </aside>
      </div>
    </PageTransition>
  );
}
