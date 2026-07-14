"use client";

// Add / edit a runway. On CREATE the two thresholds are derived server-side
// from the airport reference point; editing does NOT recompute thresholds.
import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Layers } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/components/providers";
import {
  APPROACH_TYPES,
  APPROACH_TYPE_LABELS,
  fetchJson,
  jsonBody,
  type ApproachType,
  type RunwayRow,
} from "./types";

const schema = z.object({
  designator: z
    .string()
    .trim()
    .regex(/^\d{2}[LRClrc]?\/\d{2}[LRClrc]?$/, "Use the form 14/32 or 14L/32R"),
  code: z.number("Select a code").int().min(1).max(4),
  approachType: z.enum(APPROACH_TYPES as [ApproachType, ...ApproachType[]]),
  lengthM: z.number("Enter a length").min(100, "Too short").max(10000),
  trueBearingDeg: z.number("Enter a bearing").min(0).max(360),
});
type FormValues = z.infer<typeof schema>;

export function RunwayDialog({
  airportId,
  editing,
  open,
  onOpenChange,
}: {
  airportId: string;
  editing: RunwayRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { designator: "", code: 4, approachType: "NON_INSTRUMENT", lengthM: 3000, trueBearingDeg: 0 },
  });
  const { register, control, formState } = form;

  React.useEffect(() => {
    if (open) {
      form.reset({
        designator: editing?.designator ?? "",
        code: editing?.code ?? 4,
        approachType: editing?.approachType ?? "NON_INSTRUMENT",
        lengthM: editing?.lengthM ?? 3000,
        trueBearingDeg: editing?.trueBearingDeg ?? 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        designator: values.designator.toUpperCase(),
        code: values.code,
        approachType: values.approachType,
        lengthM: values.lengthM,
        trueBearingDeg: values.trueBearingDeg,
      };
      return editing
        ? fetchJson(`/api/master-data/runways/${editing.id}`, { ...jsonBody(payload), method: "PATCH" })
        : fetchJson("/api/master-data/runways", jsonBody({ airportId, ...payload }));
    },
    onSuccess: () => {
      toast.success(editing ? "Runway updated" : "Runway added", {
        description: editing
          ? "Thresholds were left unchanged."
          : "Thresholds were derived from the airport reference point (approximate).",
      });
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="size-5 text-primary" aria-hidden />
            {editing ? "Edit runway" : "Add runway"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Editing keeps the existing thresholds — recreate the runway to re-derive them."
              : "The two thresholds are placed at ± length/2 along the true bearing from the airport reference point."}
          </DialogDescription>
        </DialogHeader>
        <form id="runway-form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rw-designator">Designator</Label>
              <Input id="rw-designator" placeholder="14/32" className="uppercase" aria-invalid={!!formState.errors.designator} {...register("designator")} />
              {err("designator")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rw-code">Reference code</Label>
              <Controller
                control={control}
                name="code"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger id="rw-code" aria-invalid={!!formState.errors.code}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((c) => (
                        <SelectItem key={c} value={String(c)}>Code {c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rw-approach">Approach type</Label>
            <Controller
              control={control}
              name="approachType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="rw-approach">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPROACH_TYPES.map((a) => (
                      <SelectItem key={a} value={a}>{APPROACH_TYPE_LABELS[a]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rw-length">Length (m)</Label>
              <Input id="rw-length" type="number" step="any" inputMode="decimal" placeholder="3200" aria-invalid={!!formState.errors.lengthM} {...register("lengthM", { valueAsNumber: true })} />
              {err("lengthM")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rw-bearing">True bearing (°)</Label>
              <Input id="rw-bearing" type="number" step="any" inputMode="decimal" placeholder="143" aria-invalid={!!formState.errors.trueBearingDeg} {...register("trueBearingDeg", { valueAsNumber: true })} />
              {err("trueBearingDeg")}
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="runway-form" disabled={!formState.isValid || mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {mutation.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
