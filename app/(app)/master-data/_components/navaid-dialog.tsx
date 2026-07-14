"use client";

// Add / edit a navaid (CNS aid) on an airport.
import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Radio } from "lucide-react";
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
  jsonBody,
  NAVAID_TYPES,
  NAVAID_TYPE_LABELS,
  type NavaidRow,
  type NavaidType,
} from "./types";

const schema = z.object({
  type: z.enum(NAVAID_TYPES as [NavaidType, ...NavaidType[]]),
  name: z.string().trim().max(120).optional(),
  lat: z.number("Enter a latitude").min(-90).max(90),
  lon: z.number("Enter a longitude").min(-180).max(180),
  protectionRadiusM: z.number("Enter a radius").min(0).max(20000),
  note: z.string().trim().max(2000).optional(),
});
type FormValues = z.infer<typeof schema>;

export function NavaidDialog({
  airportId,
  editing,
  open,
  onOpenChange,
}: {
  airportId: string;
  editing: NavaidRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { type: "VOR", name: "", protectionRadiusM: 3000, note: "" },
  });
  const { register, control, formState } = form;

  React.useEffect(() => {
    if (open) {
      form.reset({
        type: editing?.type ?? "VOR",
        name: editing?.name ?? "",
        lat: editing?.lat,
        lon: editing?.lon,
        protectionRadiusM: editing?.protectionRadiusM ?? 3000,
        note: editing?.note ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        type: values.type,
        name: values.name?.trim() || undefined,
        lat: values.lat,
        lon: values.lon,
        protectionRadiusM: values.protectionRadiusM,
        note: values.note?.trim() || undefined,
      };
      return editing
        ? fetchJson(`/api/master-data/navaids/${editing.id}`, { ...jsonBody(payload), method: "PATCH" })
        : fetchJson("/api/master-data/navaids", jsonBody({ airportId, ...payload }));
    },
    onSuccess: () => {
      toast.success(editing ? "Navaid updated" : "Navaid added");
      queryClient.invalidateQueries({ queryKey: ["md-airport", airportId] });
      queryClient.invalidateQueries({ queryKey: ["md-airports"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  const err = (name: keyof FormValues) =>
    formState.errors[name] ? (
      <p className="text-sm text-destructive" role="alert">
        {formState.errors[name]?.message as string}
      </p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="size-5 text-primary" aria-hidden />
            {editing ? "Edit navaid" : "Add navaid"}
          </DialogTitle>
          <DialogDescription>Navigation aid with its CNS protection radius.</DialogDescription>
        </DialogHeader>
        <form id="navaid-form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nv-type">Type</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="nv-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NAVAID_TYPES.map((n) => (
                        <SelectItem key={n} value={n}>{NAVAID_TYPE_LABELS[n]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nv-name">
                Name <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Input id="nv-name" placeholder="DAC VOR" {...register("name")} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nv-lat">{t("public.latitude")}</Label>
              <Input id="nv-lat" type="number" step="any" inputMode="decimal" placeholder="23.8433" aria-invalid={!!formState.errors.lat} {...register("lat", { valueAsNumber: true })} />
              {err("lat")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nv-lon">{t("public.longitude")}</Label>
              <Input id="nv-lon" type="number" step="any" inputMode="decimal" placeholder="90.3978" aria-invalid={!!formState.errors.lon} {...register("lon", { valueAsNumber: true })} />
              {err("lon")}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nv-radius">Protection radius (m)</Label>
            <Input id="nv-radius" type="number" step="any" inputMode="decimal" placeholder="3000" aria-invalid={!!formState.errors.protectionRadiusM} {...register("protectionRadiusM", { valueAsNumber: true })} />
            {err("protectionRadiusM")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="nv-note">
              Note <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
            </Label>
            <Textarea id="nv-note" rows={2} {...register("note")} />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="navaid-form" disabled={!formState.isValid || mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {mutation.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
