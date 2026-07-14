"use client";

// Log a public/field complaint about a structure — creates a COMPLAINT-source
// obstacle in UNDER_MONITORING status (the API notifies AGA + intake officers).
import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Megaphone } from "lucide-react";
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
import { useT } from "@/components/providers";
import {
  fetchJson,
  STRUCTURE_TYPE_OPTIONS,
  type AirportOption,
  type ObstacleRow,
} from "../../_components/types";

const schema = z.object({
  airportId: z.string().min(1, "Select an airport"),
  name: z.string().trim().min(2, "Describe the structure").max(120),
  structureType: z.string().min(2, "Select a structure type"),
  locationText: z.string().trim().min(3, "Describe the location").max(300),
  lat: z
    .number("Enter a latitude")
    .min(-90, "Must be between −90 and 90")
    .max(90, "Must be between −90 and 90"),
  lon: z
    .number("Enter a longitude")
    .min(-180, "Must be between −180 and 180")
    .max(180, "Must be between −180 and 180"),
  heightAglM: z
    .number("Enter the approximate height")
    .min(1, "Must be at least 1 m")
    .max(1000, "Maximum 1,000 m"),
  groundElevationM: z
    .number("Enter the ground elevation")
    .min(-100, "Minimum −100 m")
    .max(2000, "Maximum 2,000 m"),
  note: z.string().trim().min(5, "Add the complainant's note (at least 5 characters)").max(1500),
});

type FormValues = z.infer<typeof schema>;

export function LogComplaintDialog({
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
    defaultValues: { airportId: "", name: "", structureType: "", locationText: "", note: "" },
  });
  const { register, formState } = form;

  React.useEffect(() => {
    if (open) {
      form.reset({ airportId: "", name: "", structureType: "", locationText: "", note: "" });
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
          heightAglM: values.heightAglM,
          groundElevationM: values.groundElevationM,
          source: "COMPLAINT",
          remarks: `Location: ${values.locationText}\nComplainant note: ${values.note}`,
        }),
      }),
    onSuccess: (data) => {
      toast.success("Complaint logged", {
        description: `${data.obstacle.name ?? data.obstacle.structureType} placed under monitoring — AGA and intake officers have been notified.`,
      });
      queryClient.invalidateQueries({ queryKey: ["obstacles"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(t("common.error"), { description: error.message });
    },
  });

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
            <Megaphone className="size-5 text-warning" aria-hidden />
            Log complaint
          </DialogTitle>
          <DialogDescription>
            Record a reported structure for verification. It enters the register as a
            complaint under monitoring and alerts the responsible officers.
          </DialogDescription>
        </DialogHeader>

        <form
          id="log-complaint-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="complaint-airport">{t("common.airport")}</Label>
              <Controller
                control={form.control}
                name="airportId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="complaint-airport"
                      aria-invalid={!!formState.errors.airportId}
                    >
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
              <Label htmlFor="complaint-structure-type">{t("application.structureType")}</Label>
              <Controller
                control={form.control}
                name="structureType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="complaint-structure-type"
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
            <Label htmlFor="complaint-name">Structure description</Label>
            <Input
              id="complaint-name"
              placeholder="e.g. Unmarked lattice tower under construction"
              aria-invalid={!!formState.errors.name}
              {...register("name")}
            />
            {fieldError("name")}
          </div>

          <div className="space-y-2">
            <Label htmlFor="complaint-location">Location description</Label>
            <Input
              id="complaint-location"
              placeholder="e.g. North of Dakshinkhan, beside the rail crossing"
              aria-invalid={!!formState.errors.locationText}
              {...register("locationText")}
            />
            {fieldError("locationText")}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="complaint-lat">{t("public.latitude")}</Label>
              <Input
                id="complaint-lat"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="23.8433"
                aria-invalid={!!formState.errors.lat}
                {...register("lat", { valueAsNumber: true })}
              />
              {fieldError("lat")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="complaint-lon">{t("public.longitude")}</Label>
              <Input
                id="complaint-lon"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="90.3978"
                aria-invalid={!!formState.errors.lon}
                {...register("lon", { valueAsNumber: true })}
              />
              {fieldError("lon")}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="complaint-height">
                Height (m AGL){" "}
                <span className="text-muted-foreground font-normal">
                  ({t("common.approximate")})
                </span>
              </Label>
              <Input
                id="complaint-height"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="40"
                aria-invalid={!!formState.errors.heightAglM}
                {...register("heightAglM", { valueAsNumber: true })}
              />
              {fieldError("heightAglM")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="complaint-ground">{t("public.groundElevation")}</Label>
              <Input
                id="complaint-ground"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="8"
                aria-invalid={!!formState.errors.groundElevationM}
                {...register("groundElevationM", { valueAsNumber: true })}
              />
              {fieldError("groundElevationM")}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="complaint-note">Complainant note</Label>
            <Textarea
              id="complaint-note"
              rows={3}
              placeholder="What was reported, by whom, and when…"
              aria-invalid={!!formState.errors.note}
              {...register("note")}
            />
            {fieldError("note")}
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
            form="log-complaint-form"
            disabled={!formState.isValid || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {mutation.isPending ? t("common.submitting") : "Log complaint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
