"use client";

// Create a new airport (RHF + Zod → POST /api/master-data/airports).
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
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
import { useT } from "@/components/providers";
import { fetchJson, jsonBody } from "./types";

const schema = z.object({
  icao: z.string().trim().min(3, "3–4 letters").max(4).regex(/^[A-Za-z]{3,4}$/, "Letters only"),
  iata: z.string().trim().max(4).optional(),
  name: z.string().trim().min(2, "Name is required").max(120),
  nameBn: z.string().trim().max(160).optional(),
  city: z.string().trim().min(1, "City is required").max(80),
  elevationM: z.number("Enter an elevation").min(-100).max(5000),
  referenceLat: z.number("Enter a latitude").min(-90).max(90),
  referenceLon: z.number("Enter a longitude").min(-180).max(180),
});
type FormValues = z.infer<typeof schema>;

export function AirportCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onChange" });
  const { register, formState } = form;

  React.useEffect(() => {
    if (open) form.reset({ icao: "", iata: "", name: "", nameBn: "", city: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      fetchJson<{ airport: { icao: string } }>(
        "/api/master-data/airports",
        jsonBody({
          icao: values.icao.toUpperCase(),
          iata: values.iata?.trim() ? values.iata.toUpperCase() : undefined,
          name: values.name,
          nameBn: values.nameBn?.trim() || undefined,
          city: values.city,
          elevationM: values.elevationM,
          referenceLat: values.referenceLat,
          referenceLon: values.referenceLon,
        })
      ),
    onSuccess: (data) => {
      toast.success(`Airport ${data.airport.icao} added`, {
        description: "Add runways and OLS parameters from the airport editor.",
      });
      queryClient.invalidateQueries({ queryKey: ["md-airports"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  const numeric = (name: "elevationM" | "referenceLat" | "referenceLon") =>
    register(name, { valueAsNumber: true });
  const err = (name: keyof FormValues) =>
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
            <Building2 className="size-5 text-primary" aria-hidden />
            Add airport
          </DialogTitle>
          <DialogDescription>
            Aerodrome reference data. The reference point anchors all OLS geometry — confirm
            against the CAAB AIP.
          </DialogDescription>
        </DialogHeader>
        <form id="airport-create-form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ap-icao">ICAO</Label>
              <Input id="ap-icao" placeholder="VGHS" className="font-mono uppercase" aria-invalid={!!formState.errors.icao} {...register("icao")} />
              {err("icao")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ap-iata">
                IATA <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Input id="ap-iata" placeholder="DAC" className="font-mono uppercase" {...register("iata")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ap-name">Name</Label>
            <Input id="ap-name" placeholder="Hazrat Shahjalal International Airport" aria-invalid={!!formState.errors.name} {...register("name")} />
            {err("name")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ap-name-bn">
                Name (Bangla) <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Input id="ap-name-bn" {...register("nameBn")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ap-city">City</Label>
              <Input id="ap-city" placeholder="Dhaka" aria-invalid={!!formState.errors.city} {...register("city")} />
              {err("city")}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ap-elev">Elevation (m)</Label>
              <Input id="ap-elev" type="number" step="any" inputMode="decimal" placeholder="9" aria-invalid={!!formState.errors.elevationM} {...numeric("elevationM")} />
              {err("elevationM")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ap-lat">Ref. latitude</Label>
              <Input id="ap-lat" type="number" step="any" inputMode="decimal" placeholder="23.8433" aria-invalid={!!formState.errors.referenceLat} {...numeric("referenceLat")} />
              {err("referenceLat")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ap-lon">Ref. longitude</Label>
              <Input id="ap-lon" type="number" step="any" inputMode="decimal" placeholder="90.3978" aria-invalid={!!formState.errors.referenceLon} {...numeric("referenceLon")} />
              {err("referenceLon")}
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="airport-create-form" disabled={!formState.isValid || mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {mutation.isPending ? t("common.saving") : "Add airport"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
