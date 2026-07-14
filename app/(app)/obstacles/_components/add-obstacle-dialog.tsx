"use client";

// Add a surveyed / reported obstacle to the register (RHF + Zod → POST /api/obstacles).
import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MountainSnow } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/components/providers";
import {
  fetchJson,
  STRUCTURE_TYPE_OPTIONS,
  SOURCE_LABELS,
  type AirportOption,
  type ObstacleRow,
} from "./types";

const schema = z
  .object({
    airportId: z.string().min(1, "Select an airport"),
    name: z.string().trim().min(2, "Name is required").max(120),
    structureType: z.string().min(2, "Select a structure type"),
    lat: z
      .number("Enter a latitude")
      .min(-90, "Must be between −90 and 90")
      .max(90, "Must be between −90 and 90"),
    lon: z
      .number("Enter a longitude")
      .min(-180, "Must be between −180 and 180")
      .max(180, "Must be between −180 and 180"),
    elevMode: z.enum(["top", "agl"]),
    topElevationAmslM: z.number().min(-100).max(3000).optional(),
    heightAglM: z.number().min(0).max(1000).optional(),
    groundElevationM: z.number().min(-100).max(2000).optional(),
    source: z.enum(["SURVEY", "COMPLAINT"]),
    remarks: z.string().trim().max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.elevMode === "top") {
      if (v.topElevationAmslM == null || Number.isNaN(v.topElevationAmslM)) {
        ctx.addIssue({
          code: "custom",
          path: ["topElevationAmslM"],
          message: "Enter the top elevation",
        });
      }
    } else {
      if (v.heightAglM == null || Number.isNaN(v.heightAglM)) {
        ctx.addIssue({ code: "custom", path: ["heightAglM"], message: "Enter the height" });
      }
      if (v.groundElevationM == null || Number.isNaN(v.groundElevationM)) {
        ctx.addIssue({
          code: "custom",
          path: ["groundElevationM"],
          message: "Enter the ground elevation",
        });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

export function AddObstacleDialog({
  open,
  onOpenChange,
  airports,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  airports: AirportOption[];
}) {
  const t = useT();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      airportId: "",
      name: "",
      structureType: "",
      elevMode: "top",
      source: "SURVEY",
      remarks: "",
    },
  });
  const { register, formState } = form;
  const elevMode = form.watch("elevMode");

  React.useEffect(() => {
    if (open) {
      form.reset({
        airportId: "",
        name: "",
        structureType: "",
        elevMode: "top",
        source: "SURVEY",
        remarks: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      fetchJson<{ obstacle: ObstacleRow }>("/api/obstacles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          airportId: values.airportId,
          name: values.name,
          structureType: values.structureType,
          lat: values.lat,
          lon: values.lon,
          source: values.source,
          remarks: values.remarks?.trim() || undefined,
          ...(values.elevMode === "top"
            ? { topElevationAmslM: values.topElevationAmslM }
            : {
                heightAglM: values.heightAglM,
                groundElevationM: values.groundElevationM,
              }),
        }),
      }),
    onSuccess: (data) => {
      toast.success(`Obstacle added — ${data.obstacle.name ?? data.obstacle.structureType}`, {
        description: `Recorded as ${t(`status.${data.obstacle.status}`)} at ${data.obstacle.airport.icao}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["obstacles"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(t("common.error"), { description: error.message });
    },
  });

  const numberField = (name: "lat" | "lon" | "topElevationAmslM" | "heightAglM" | "groundElevationM") =>
    register(name, { valueAsNumber: true });

  const fieldError = (name: keyof FormValues) =>
    formState.errors[name] ? (
      <p className="text-sm text-destructive" role="alert">
        {formState.errors[name]?.message as string}
      </p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MountainSnow className="size-5 text-primary" aria-hidden />
            Add obstacle
          </DialogTitle>
          <DialogDescription>
            Register a surveyed structure or a reported complaint. Survey entries are
            checked against the OLS immediately; complaints start under monitoring.
          </DialogDescription>
        </DialogHeader>

        <form
          id="add-obstacle-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="obstacle-airport">{t("common.airport")}</Label>
              <Controller
                control={form.control}
                name="airportId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="obstacle-airport" aria-invalid={!!formState.errors.airportId}>
                      <SelectValue placeholder={t("common.airport")} />
                    </SelectTrigger>
                    <SelectContent>
                      {airports.map((airport) => (
                        <SelectItem key={airport.id} value={airport.id}>
                          {airport.icao} — {airport.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {fieldError("airportId")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="obstacle-structure-type">{t("application.structureType")}</Label>
              <Controller
                control={form.control}
                name="structureType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="obstacle-structure-type"
                      aria-invalid={!!formState.errors.structureType}
                    >
                      <SelectValue placeholder={t("application.structureType")} />
                    </SelectTrigger>
                    <SelectContent>
                      {STRUCTURE_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {fieldError("structureType")}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="obstacle-name">Structure name</Label>
            <Input
              id="obstacle-name"
              placeholder="e.g. Uttara telecom mast"
              aria-invalid={!!formState.errors.name}
              {...register("name")}
            />
            {fieldError("name")}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="obstacle-lat">{t("public.latitude")}</Label>
              <Input
                id="obstacle-lat"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="23.8433"
                aria-invalid={!!formState.errors.lat}
                {...numberField("lat")}
              />
              {fieldError("lat")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="obstacle-lon">{t("public.longitude")}</Label>
              <Input
                id="obstacle-lon"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="90.3978"
                aria-invalid={!!formState.errors.lon}
                {...numberField("lon")}
              />
              {fieldError("lon")}
            </div>
          </div>

          <div className="space-y-2">
            <Label id="obstacle-elev-mode-label">Elevation input</Label>
            <Controller
              control={form.control}
              name="elevMode"
              render={({ field }) => (
                <Tabs value={field.value} onValueChange={field.onChange}>
                  <TabsList
                    className="grid w-full grid-cols-2"
                    aria-labelledby="obstacle-elev-mode-label"
                  >
                    <TabsTrigger value="top">Top elevation (AMSL)</TabsTrigger>
                    <TabsTrigger value="agl">Height (AGL) + ground</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            />
            {elevMode === "top" ? (
              <div className="space-y-2 pt-1">
                <Label htmlFor="obstacle-top">Top elevation (m AMSL)</Label>
                <Input
                  id="obstacle-top"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="76.5"
                  aria-invalid={!!formState.errors.topElevationAmslM}
                  {...numberField("topElevationAmslM")}
                />
                {fieldError("topElevationAmslM")}
              </div>
            ) : (
              <div className="grid gap-4 pt-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="obstacle-agl">Height (m AGL)</Label>
                  <Input
                    id="obstacle-agl"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    placeholder="45"
                    aria-invalid={!!formState.errors.heightAglM}
                    {...numberField("heightAglM")}
                  />
                  {fieldError("heightAglM")}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="obstacle-ground">{t("public.groundElevation")}</Label>
                  <Input
                    id="obstacle-ground"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    placeholder="8"
                    aria-invalid={!!formState.errors.groundElevationM}
                    {...numberField("groundElevationM")}
                  />
                  {fieldError("groundElevationM")}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="obstacle-source">Source</Label>
            <Controller
              control={form.control}
              name="source"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="obstacle-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SURVEY">{SOURCE_LABELS.SURVEY}</SelectItem>
                    <SelectItem value="COMPLAINT">{SOURCE_LABELS.COMPLAINT}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="obstacle-remarks">
              {t("common.remarks")}{" "}
              <span className="text-muted-foreground font-normal">({t("common.optional")})</span>
            </Label>
            <Textarea
              id="obstacle-remarks"
              rows={2}
              placeholder="Survey reference, observations…"
              {...register("remarks")}
            />
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="add-obstacle-form"
            disabled={!formState.isValid || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {mutation.isPending ? t("common.saving") : "Add obstacle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
