"use client";

/**
 * Public Height Check — the showcase screen.
 * Airport select → OLS overlays on a live map → draggable/clickable site
 * marker → debounced POST /api/evaluate → CLEAR / OBJECTION / OUTSIDE result
 * with governing surface, PTE, permissible AGL and a per-surface breakdown.
 */
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type * as GeoJSON from "geojson";
import {
  CheckCircle2,
  CircleSlash,
  Crosshair,
  Info,
  MousePointerClick,
  Ruler,
  XCircle,
} from "lucide-react";
import { OlsMap, OlsLegend, type SiteStatus } from "@/components/map/ols-map";
import { PageTransition, FadeIn, AnimatePresence, motion } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/components/providers";
import { formatMetres, toDMS } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─────────────────────────── contracts ───────────────────────────

interface AirportListItem {
  id: string;
  icao: string;
  iata: string | null;
  name: string;
  city: string;
  elevationM: number;
  referenceLat: number;
  referenceLon: number;
}

interface OlsPayload {
  airport: {
    icao: string;
    name: string;
    city: string;
    elevationM: number;
    referenceLat: number;
    referenceLon: number;
    paramSetVersion: number | null;
  };
  surfaces: GeoJSON.FeatureCollection;
  runways: GeoJSON.FeatureCollection;
  navaids: Array<{ lat: number; lon: number; type: string; name: string | null }>;
}

interface SurfaceHit {
  kind: string;
  name: string;
  runway: string;
  end?: string;
  elevationAmslM: number;
  penetrated: boolean;
}

interface EvalResult {
  status: "CLEAR" | "OBJECTION" | "OUTSIDE";
  ptE_amslM: number | null;
  permissibleAglM: number | null;
  penetrationM: number | null;
  requestedTopAmslM: number;
  governingSurface: string | null;
  governingDomain: "AGA" | "CNS" | "PANSOPS" | null;
  agaPtE_amslM: number | null;
  distanceToNearestRunwayM: number;
  surfaces: SurfaceHit[];
  engineVersion: string;
}

interface EvalResponse {
  airport: { icao: string; name: string };
  result: EvalResult;
}

const schema = z.object({
  lat: z.number({ error: "Latitude is required" }).min(-90).max(90),
  lon: z.number({ error: "Longitude is required" }).min(-180).max(180),
  groundElevationM: z
    .number({ error: "Ground elevation is required" })
    .min(-100, "Too low")
    .max(2000, "Too high"),
  requestedHeightAglM: z
    .number({ error: "Proposed height is required" })
    .min(0, "Must be at least 0")
    .max(1000, "Maximum 1000 m"),
});
type FormValues = z.infer<typeof schema>;

// ─────────────────────────── component ───────────────────────────

export function HeightCheckClient() {
  const t = useT();
  const [icaoState, setIcaoState] = React.useState<string | null>(null);
  const [evaluation, setEvaluation] = React.useState<EvalResponse | null>(null);
  const [evaluating, setEvaluating] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const airportsQuery = useQuery<AirportListItem[]>({
    queryKey: ["airports"],
    queryFn: async () => {
      const res = await fetch("/api/airports");
      if (!res.ok) throw new Error("Failed to load airports");
      return res.json();
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    // Defaults sit ~2 km NE of the VGHS (Dhaka) reference point.
    defaultValues: { lat: 23.8615, lon: 90.4172, groundElevationM: 8, requestedHeightAglM: 45 },
  });
  const { register, setValue, formState } = form;
  const watched = useWatch({ control: form.control });
  const parsed = React.useMemo(() => schema.safeParse(watched), [watched]);
  const valid = parsed.success;

  const airports = React.useMemo(() => airportsQuery.data ?? [], [airportsQuery.data]);
  // Derived selection: Dhaka (VGHS) until the visitor picks another airport.
  const icao =
    icaoState ?? (airports.find((a) => a.icao === "VGHS") ?? airports[0])?.icao ?? "";
  const selected = airports.find((a) => a.icao === icao) ?? null;

  const olsQuery = useQuery<OlsPayload>({
    queryKey: ["airport-ols", icao],
    queryFn: async () => {
      const res = await fetch(`/api/airports/${icao}/ols`);
      if (!res.ok) throw new Error("Failed to load OLS surfaces");
      return res.json();
    },
    enabled: icao.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Sensible defaults near the selected airport (~2 km NE of the ARP).
  const applyAirportDefaults = React.useCallback(
    (airport: AirportListItem) => {
      setValue("lat", Number((airport.referenceLat + 0.018).toFixed(6)), { shouldValidate: true });
      setValue("lon", Number((airport.referenceLon + 0.01).toFixed(6)), { shouldValidate: true });
      setValue("groundElevationM", Number(airport.elevationM.toFixed(1)), { shouldValidate: true });
      setEvaluation(null);
    },
    [setValue]
  );

  const handleAirportChange = React.useCallback(
    (next: string) => {
      setIcaoState(next);
      const airport = airports.find((a) => a.icao === next);
      if (airport) applyAirportDefaults(airport);
    },
    [airports, applyAirportDefaults]
  );

  const runEvaluate = React.useCallback(
    async (input: FormValues, opts: { toastErrors?: boolean } = {}) => {
      if (!icao) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setEvaluating(true);
      try {
        const res = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ icao, ...input }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Evaluation failed");
        const data: EvalResponse = await res.json();
        setEvaluation(data);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        if (opts.toastErrors) toast.error((error as Error).message || t("common.error"));
      } finally {
        if (abortRef.current === controller) setEvaluating(false);
      }
    },
    [icao, t]
  );

  // Live evaluation, debounced on any input change.
  React.useEffect(() => {
    if (!icao || !parsed.success) return;
    const input = parsed.data;
    const timer = setTimeout(() => runEvaluate(input), 450);
    return () => clearTimeout(timer);
  }, [icao, parsed, runEvaluate]);

  const setSite = React.useCallback(
    (pos: { lat: number; lon: number }) => {
      setValue("lat", Number(pos.lat.toFixed(6)), { shouldValidate: true, shouldDirty: true });
      setValue("lon", Number(pos.lon.toFixed(6)), { shouldValidate: true, shouldDirty: true });
    },
    [setValue]
  );

  const result = evaluation?.result ?? null;
  const siteStatus: SiteStatus = result?.status ?? "NONE";
  const site =
    typeof watched.lat === "number" &&
    Number.isFinite(watched.lat) &&
    typeof watched.lon === "number" &&
    Number.isFinite(watched.lon)
      ? { lat: watched.lat, lon: watched.lon }
      : null;
  const center: [number, number] = selected
    ? [selected.referenceLon, selected.referenceLat]
    : [90.4172, 23.8433];

  const loadingPage = airportsQuery.isLoading;

  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <PageHeader
          crumbs={[{ label: t("nav.home"), href: "/" }, { label: t("nav.heightCheck") }]}
          title={t("public.heightCheckTitle")}
          description={t("public.heightCheckSubtitle")}
        />

        {loadingPage ? (
          <HeightCheckSkeleton />
        ) : (
          <div className="grid gap-6 lg:grid-cols-5">
            {/* ── Parameters + result ── */}
            <div className="space-y-4 lg:col-span-2">
              <Card className="gap-4 p-5">
                <div className="space-y-1.5">
                  <Label htmlFor="hc-airport">{t("common.airport")}</Label>
                  <Select value={icao} onValueChange={handleAirportChange}>
                    <SelectTrigger id="hc-airport" className="w-full">
                      <SelectValue placeholder={t("common.loading")} />
                    </SelectTrigger>
                    <SelectContent>
                      {airports.map((airport) => (
                        <SelectItem key={airport.icao} value={airport.icao}>
                          {airport.icao} — {airport.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selected && (
                    <p className="text-xs text-muted-foreground">
                      {selected.city} · {selected.elevationM.toFixed(1)} m AMSL ·{" "}
                      {t("common.referenceFigure")}
                    </p>
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                    void form.handleSubmit((v) => runEvaluate(v, { toastErrors: true }))(e);
                  }}
                  className="space-y-4"
                  noValidate
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="hc-lat">{t("public.latitude")}</Label>
                      <Input
                        id="hc-lat"
                        type="number"
                        step="0.000001"
                        inputMode="decimal"
                        aria-invalid={!!formState.errors.lat}
                        {...register("lat", { valueAsNumber: true })}
                      />
                      {formState.errors.lat && (
                        <p role="alert" className="text-xs text-destructive">
                          {formState.errors.lat.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hc-lon">{t("public.longitude")}</Label>
                      <Input
                        id="hc-lon"
                        type="number"
                        step="0.000001"
                        inputMode="decimal"
                        aria-invalid={!!formState.errors.lon}
                        {...register("lon", { valueAsNumber: true })}
                      />
                      {formState.errors.lon && (
                        <p role="alert" className="text-xs text-destructive">
                          {formState.errors.lon.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hc-elev">{t("public.groundElevation")}</Label>
                      <Input
                        id="hc-elev"
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        aria-invalid={!!formState.errors.groundElevationM}
                        {...register("groundElevationM", { valueAsNumber: true })}
                      />
                      {formState.errors.groundElevationM && (
                        <p role="alert" className="text-xs text-destructive">
                          {formState.errors.groundElevationM.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hc-height">{t("public.requestedHeight")}</Label>
                      <Input
                        id="hc-height"
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        aria-invalid={!!formState.errors.requestedHeightAglM}
                        {...register("requestedHeightAglM", { valueAsNumber: true })}
                      />
                      {formState.errors.requestedHeightAglM && (
                        <p role="alert" className="text-xs text-destructive">
                          {formState.errors.requestedHeightAglM.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={!valid || evaluating} className="flex-1">
                      <Ruler className="size-4" aria-hidden />
                      {evaluating ? t("common.loading") : t("public.checkNow")}
                    </Button>
                    {selected && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Reset to airport vicinity"
                        onClick={() => applyAirportDefaults(selected)}
                      >
                        <Crosshair className="size-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                </form>

                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <MousePointerClick className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Click anywhere on the map — or drag the marker — to move the site. The result
                  updates live.
                </p>
              </Card>

              {/* Result panel */}
              <ResultPanel result={result} evaluating={evaluating} />

              <Alert>
                <Info className="size-4" aria-hidden />
                <AlertTitle>{t("common.details")}</AlertTitle>
                <AlertDescription>{t("public.disclaimer")}</AlertDescription>
              </Alert>
            </div>

            {/* ── Map ── */}
            <div className="lg:col-span-3">
              <Card className="gap-3 overflow-hidden p-0">
                <div className="relative">
                  <OlsMap
                    center={center}
                    zoom={11.4}
                    surfaces={olsQuery.data?.surfaces ?? null}
                    runways={olsQuery.data?.runways ?? null}
                    navaids={olsQuery.data?.navaids ?? []}
                    site={site}
                    siteStatus={siteStatus}
                    siteDraggable
                    onSiteChange={setSite}
                    onMapClick={setSite}
                    className="h-[420px] w-full lg:h-[560px]"
                  />
                  {olsQuery.isFetching && (
                    <div
                      className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-card/90 px-3 py-2 text-xs text-muted-foreground"
                      role="status"
                    >
                      <Skeleton className="size-3 rounded-full" />
                      Loading obstacle limitation surfaces…
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3">
                  <OlsLegend />
                  {site && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {toDMS(site.lat, "lat")} {toDMS(site.lon, "lon")}
                    </span>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

// ─────────────────────────── result panel ───────────────────────────

function ResultPanel({ result, evaluating }: { result: EvalResult | null; evaluating: boolean }) {
  const t = useT();

  if (!result) {
    return (
      <FadeIn>
        <Card className="p-5">
          {evaluating ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full rounded-lg" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select an airport and place the site marker to see the indicative permissible
              height.
            </p>
          )}
        </Card>
      </FadeIn>
    );
  }

  const banner =
    result.status === "CLEAR"
      ? {
          className: "bg-success text-success-foreground",
          icon: CheckCircle2,
          label: t("public.resultClear"),
        }
      : result.status === "OBJECTION"
        ? {
            className: "bg-destructive text-destructive-foreground",
            icon: XCircle,
            label: t("public.resultObjection"),
          }
        : {
            className: "bg-muted text-muted-foreground",
            icon: CircleSlash,
            label: t("public.resultOutside"),
          };

  return (
    <Card className={cn("gap-4 p-5", evaluating && "opacity-80 transition-opacity")}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={result.status}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          role="status"
          aria-live="polite"
          className={cn("flex items-center gap-3 rounded-lg px-4 py-3.5", banner.className)}
        >
          <banner.icon className="size-7 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-base font-semibold leading-tight">{result.status}</p>
            <p className="text-xs leading-snug opacity-90">{banner.label}</p>
          </div>
          <StatusBadge status={result.status} className="ml-auto border-white/40 bg-white/15 text-white" />
        </motion.div>
      </AnimatePresence>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Metric
          label={t("public.governingSurface")}
          value={
            result.governingSurface ? (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                {result.governingSurface}
                {result.governingDomain && (
                  <Badge variant="outline" className="text-[10px]">
                    {result.governingDomain}
                  </Badge>
                )}
              </span>
            ) : (
              "—"
            )
          }
        />
        <Metric
          label={t("public.permissibleTopElevation")}
          value={result.ptE_amslM != null ? `${formatMetres(result.ptE_amslM)} AMSL` : "—"}
        />
        <Metric
          label={t("public.permissibleHeight")}
          value={result.permissibleAglM != null ? `${formatMetres(result.permissibleAglM)} AGL` : "—"}
        />
        <Metric
          label={t("application.requestedTop")}
          value={`${formatMetres(result.requestedTopAmslM)} AMSL`}
        />
        <Metric
          label={t("public.penetration")}
          value={
            result.penetrationM != null && result.penetrationM > 0 ? (
              <span className="font-semibold text-destructive">
                +{formatMetres(result.penetrationM)}
              </span>
            ) : (
              <span className="text-success">{t("common.none")}</span>
            )
          }
        />
        <Metric
          label="Nearest runway"
          value={`${(result.distanceToNearestRunwayM / 1000).toFixed(2)} km`}
        />
      </dl>

      {result.surfaces.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Surface</TableHead>
                <TableHead>RWY</TableHead>
                <TableHead className="text-right">Limit (m AMSL)</TableHead>
                <TableHead className="text-right">Margin (m)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.surfaces.map((surface) => {
                const margin = surface.elevationAmslM - result.requestedTopAmslM;
                return (
                  <TableRow
                    key={`${surface.name}-${surface.runway}-${surface.end ?? ""}`}
                    className={cn(surface.penetrated && "bg-destructive/10 hover:bg-destructive/15")}
                  >
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {surface.penetrated && (
                          <XCircle className="size-3.5 text-destructive" aria-hidden />
                        )}
                        {surface.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{surface.runway}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {surface.elevationAmslM.toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium tabular-nums",
                        margin < 0 ? "text-destructive" : "text-success"
                      )}
                    >
                      {margin >= 0 ? "+" : ""}
                      {margin.toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Engine {result.engineVersion} · AGA PTE{" "}
        {result.agaPtE_amslM != null ? `${result.agaPtE_amslM.toFixed(2)} m AMSL` : "—"}
      </p>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function HeightCheckSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-5" aria-busy="true">
      <div className="space-y-4 lg:col-span-2">
        <Skeleton className="h-[360px] rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <Skeleton className="h-[560px] rounded-xl lg:col-span-3" />
    </div>
  );
}
