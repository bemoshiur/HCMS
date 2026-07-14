"use client";

// Airport editor (brief §17): a side Sheet with the airport fields (PATCH) plus
// Runways, Navaids and OLS Parameters sub-sections. Opened by row-click.
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Layers,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Radio,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useT } from "@/components/providers";
import { formatCoords, formatDate, formatMetres } from "@/lib/format";
import {
  APPROACH_TYPE_LABELS,
  defaultOlsParameters,
  fetchJson,
  FRAMEWORK_LABELS,
  jsonBody,
  NAVAID_TYPE_LABELS,
  type AirportDetail,
  type NavaidRow,
  type OlsParamSetRow,
  type OlsParameters,
  type RunwayRow,
} from "./types";
import { RunwayDialog } from "./runway-dialog";
import { NavaidDialog } from "./navaid-dialog";
import { OlsParamsDialog } from "./ols-params-dialog";

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  nameBn: z.string().trim().max(160).optional(),
  iata: z.string().trim().max(4).optional(),
  city: z.string().trim().min(1, "City is required").max(80),
  elevationM: z.number("Enter an elevation").min(-100).max(5000),
  referenceLat: z.number("Enter a latitude").min(-90).max(90),
  referenceLon: z.number("Enter a longitude").min(-180).max(180),
  active: z.boolean(),
});
type DetailsValues = z.infer<typeof detailsSchema>;

export function AirportEditorSheet({
  airportId,
  onOpenChange,
}: {
  airportId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const open = airportId != null;

  const { data, isLoading } = useQuery({
    queryKey: ["md-airport", airportId],
    queryFn: () => fetchJson<{ airport: AirportDetail }>(`/api/master-data/airports/${airportId}`),
    enabled: open,
  });
  const airport = data?.airport;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-primary" aria-hidden />
            {airport ? (
              <>
                <span className="font-mono">{airport.icao}</span>
                <span className="text-muted-foreground">·</span>
                <span className="truncate">{airport.name}</span>
              </>
            ) : (
              "Airport editor"
            )}
          </SheetTitle>
          <SheetDescription>
            Edit aerodrome data, runways, navaids and OLS parameter versions.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading || !airport ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <Tabs defaultValue="details" className="gap-4">
              <TabsList className="flex-wrap">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="runways">
                  Runways
                  <Badge variant="secondary" className="ml-1.5">{airport.runways.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="navaids">
                  Navaids
                  <Badge variant="secondary" className="ml-1.5">{airport.navaids.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="ols">
                  OLS
                  <Badge variant="secondary" className="ml-1.5">{airport.olsParameterSets.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details">
                <DetailsSection airport={airport} />
              </TabsContent>
              <TabsContent value="runways">
                <RunwaysSection airport={airport} />
              </TabsContent>
              <TabsContent value="navaids">
                <NavaidsSection airport={airport} />
              </TabsContent>
              <TabsContent value="ols">
                <OlsSection airport={airport} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────── Details ───────────────────────────────

function DetailsSection({ airport }: { airport: AirportDetail }) {
  const t = useT();
  const queryClient = useQueryClient();
  const form = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    mode: "onChange",
    defaultValues: {
      name: airport.name,
      nameBn: airport.nameBn ?? "",
      iata: airport.iata ?? "",
      city: airport.city,
      elevationM: airport.elevationM,
      referenceLat: airport.referenceLat,
      referenceLon: airport.referenceLon,
      active: airport.active,
    },
  });
  const { register, formState, watch, setValue } = form;

  const mutation = useMutation({
    mutationFn: (values: DetailsValues) =>
      fetchJson(`/api/master-data/airports/${airport.id}`, {
        ...jsonBody({
          name: values.name,
          nameBn: values.nameBn?.trim() || null,
          iata: values.iata?.trim() ? values.iata.toUpperCase() : null,
          city: values.city,
          elevationM: values.elevationM,
          referenceLat: values.referenceLat,
          referenceLon: values.referenceLon,
          active: values.active,
        }),
        method: "PATCH",
      }),
    onSuccess: () => {
      toast.success("Airport updated");
      queryClient.invalidateQueries({ queryKey: ["md-airport", airport.id] });
      queryClient.invalidateQueries({ queryKey: ["md-airports"] });
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  const numeric = (name: "elevationM" | "referenceLat" | "referenceLon") =>
    register(name, { valueAsNumber: true });
  const err = (name: keyof DetailsValues) =>
    formState.errors[name] ? (
      <p className="text-sm text-destructive" role="alert">{formState.errors[name]?.message as string}</p>
    ) : null;

  return (
    <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ed-name">Name</Label>
        <Input id="ed-name" aria-invalid={!!formState.errors.name} {...register("name")} />
        {err("name")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ed-name-bn">
            Name (Bangla) <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
          </Label>
          <Input id="ed-name-bn" {...register("nameBn")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ed-iata">
            IATA <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
          </Label>
          <Input id="ed-iata" className="font-mono uppercase" {...register("iata")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ed-city">City</Label>
        <Input id="ed-city" aria-invalid={!!formState.errors.city} {...register("city")} />
        {err("city")}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="ed-elev">Elevation (m)</Label>
          <Input id="ed-elev" type="number" step="any" inputMode="decimal" aria-invalid={!!formState.errors.elevationM} {...numeric("elevationM")} />
          {err("elevationM")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ed-lat">Ref. latitude</Label>
          <Input id="ed-lat" type="number" step="any" inputMode="decimal" aria-invalid={!!formState.errors.referenceLat} {...numeric("referenceLat")} />
          {err("referenceLat")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ed-lon">Ref. longitude</Label>
          <Input id="ed-lon" type="number" step="any" inputMode="decimal" aria-invalid={!!formState.errors.referenceLon} {...numeric("referenceLon")} />
          {err("referenceLon")}
        </div>
      </div>
      <label className="flex items-center gap-3">
        <Switch checked={watch("active")} onCheckedChange={(v) => setValue("active", v, { shouldDirty: true })} />
        <span className="text-sm">Active</span>
      </label>
      {airport._count.applications + airport._count.obstacles > 0 && (
        <p className="text-xs text-muted-foreground">
          {airport._count.applications} application(s) and {airport._count.obstacles} obstacle(s) reference this airport.
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={!formState.isValid || mutation.isPending}>
          {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {mutation.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────── Runways ───────────────────────────────

function RunwaysSection({ airport }: { airport: AirportDetail }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RunwayRow | null>(null);
  const [deleting, setDeleting] = React.useState<RunwayRow | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchJson(`/api/master-data/runways/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Runway deleted");
      queryClient.invalidateQueries({ queryKey: ["md-airport", airport.id] });
      queryClient.invalidateQueries({ queryKey: ["md-airports"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-4" aria-hidden />
          Add runway
        </Button>
      </div>

      {airport.runways.length === 0 ? (
        <EmptyState icon={Layers} title="No runways" description="Add a runway to generate its thresholds and OLS geometry." />
      ) : (
        <div className="space-y-2">
          {airport.runways.map((rw) => (
            <Card key={rw.id} className="gap-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono font-medium">{rw.designator}</p>
                  <p className="text-xs text-muted-foreground">
                    Code {rw.code} · {APPROACH_TYPE_LABELS[rw.approachType]} · {formatMetres(rw.lengthM, 0)} · {rw.trueBearingDeg}°
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit runway ${rw.designator}`} onClick={() => { setEditing(rw); setDialogOpen(true); }}>
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`Delete runway ${rw.designator}`} onClick={() => setDeleting(rw)}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
              <div className="grid gap-1 border-t pt-2 text-xs text-muted-foreground sm:grid-cols-2">
                {rw.thresholds.map((th) => (
                  <div key={th.id} className="flex items-center gap-1.5">
                    <span className="font-mono font-medium text-foreground">{th.name}</span>
                    <span className="font-mono">{formatCoords(th.lat, th.lon)}</span>
                    {th.approximate && <Badge variant="outline" className="h-4 px-1 text-[10px]">{t("common.approximate")}</Badge>}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <RunwayDialog airportId={airport.id} editing={editing} open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete runway {deleting?.designator}?</AlertDialogTitle>
            <AlertDialogDescription>
              The runway and its thresholds will be removed. This affects OLS evaluations for this airport.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => { e.preventDefault(); if (deleting) deleteMutation.mutate(deleting.id); }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────── Navaids ───────────────────────────────

function NavaidsSection({ airport }: { airport: AirportDetail }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<NavaidRow | null>(null);
  const [deleting, setDeleting] = React.useState<NavaidRow | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchJson(`/api/master-data/navaids/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Navaid deleted");
      queryClient.invalidateQueries({ queryKey: ["md-airport", airport.id] });
      queryClient.invalidateQueries({ queryKey: ["md-airports"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-4" aria-hidden />
          Add navaid
        </Button>
      </div>

      {airport.navaids.length === 0 ? (
        <EmptyState icon={Radio} title="No navaids" description="Add navigation aids and their CNS protection radii." />
      ) : (
        <div className="space-y-2">
          {airport.navaids.map((nv) => (
            <Card key={nv.id} className="flex-row items-start justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  <Badge variant="outline" className="font-mono">{NAVAID_TYPE_LABELS[nv.type]}</Badge>
                  {nv.name ?? <span className="text-muted-foreground">Unnamed</span>}
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{formatCoords(nv.lat, nv.lon)}</p>
                <p className="text-xs text-muted-foreground">Protection radius {formatMetres(nv.protectionRadiusM, 0)}{nv.note ? ` · ${nv.note}` : ""}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="Edit navaid" onClick={() => { setEditing(nv); setDialogOpen(true); }}>
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="Delete navaid" onClick={() => setDeleting(nv)}>
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NavaidDialog airportId={airport.id} editing={editing} open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete navaid?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `${NAVAID_TYPE_LABELS[deleting.type]}${deleting.name ? ` (${deleting.name})` : ""}` : ""} will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => { e.preventDefault(); if (deleting) deleteMutation.mutate(deleting.id); }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────── OLS Parameters ───────────────────────────────

function OlsSection({ airport }: { airport: AirportDetail }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = React.useState(false);
  const [activating, setActivating] = React.useState<OlsParamSetRow | null>(null);

  const versions = airport.olsParameterSets;
  const activeSet = versions.find((v) => v.active) ?? null;
  const nextVersion = (versions[0]?.version ?? 0) + 1; // versions ordered desc

  // Source for a new version: active json, else highest-version json, else default.
  const source: OlsParameters = React.useMemo(
    () => activeSet?.json ?? versions[0]?.json ?? defaultOlsParameters(),
    [activeSet, versions]
  );

  const activateMutation = useMutation({
    mutationFn: (id: string) => fetchJson(`/api/master-data/ols-params/${id}`, { method: "POST" }),
    onSuccess: (_data, id) => {
      const v = versions.find((x) => x.id === id);
      toast.success(`OLS parameters v${v?.version} activated`, {
        description: "This version now governs evaluations for this airport.",
      });
      queryClient.invalidateQueries({ queryKey: ["md-airport", airport.id] });
      queryClient.invalidateQueries({ queryKey: ["md-airports"] });
      setActivating(null);
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {activeSet ? `Active: v${activeSet.version} (${FRAMEWORK_LABELS[activeSet.framework]})` : "No active version — evaluations use engine defaults."}
        </p>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="size-4" aria-hidden />
          New version
        </Button>
      </div>

      {versions.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No parameter versions"
          description="Create a version to override the engine default OLS parameters."
        />
      ) : (
        <div className="space-y-2">
          {versions.map((v) => (
            <Card key={v.id} className="flex-row items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  v{v.version}
                  {v.active ? (
                    <StatusBadge status="APPROVED" showDot={false} />
                  ) : (
                    <Badge variant="secondary" className="font-normal">Inactive</Badge>
                  )}
                  <Badge variant="outline" className="font-normal">{FRAMEWORK_LABELS[v.framework]}</Badge>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Effective {formatDate(v.effectiveFrom)}
                  {v.signedOffBy ? ` · signed off by ${v.signedOffBy}` : ""}
                </p>
              </div>
              {!v.active && (
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setActivating(v)}>
                  <CheckCircle2 className="size-4" aria-hidden />
                  Activate
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <OlsParamsDialog
        airportId={airport.id}
        icao={airport.icao}
        source={source}
        nextVersion={nextVersion}
        open={newOpen}
        onOpenChange={setNewOpen}
      />

      <AlertDialog open={!!activating} onOpenChange={(o) => !o && setActivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate OLS parameters v{activating?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deactivates the current active version and makes v{activating?.version} govern all
              future evaluations for {airport.icao}. Reference figures — confirm against the CAAB AIP
              before activating. This action is audited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={activateMutation.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (activating) activateMutation.mutate(activating.id); }}
              disabled={activateMutation.isPending}
            >
              {activateMutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Activate v{activating?.version}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
