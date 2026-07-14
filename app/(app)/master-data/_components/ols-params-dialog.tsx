"use client";

// New OLS parameter version editor (brief §17). Numeric surface values grouped
// in an accordion (plus a raw-JSON import fallback). POST creates an INACTIVE
// version; activation is a separate confirmed action. Reference data —
// everything is flagged "confirm against CAAB AIP".
import * as React from "react";
import { useForm, useFieldArray, Controller, type Path, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  OLS_FRAMEWORKS,
  FRAMEWORK_LABELS,
  type OlsFramework,
  type OlsParameters,
} from "./types";

const num = (min: number, max: number) => z.number().min(min).max(max);

const schema = z.object({
  framework: z.enum(OLS_FRAMEWORKS as [OlsFramework, ...OlsFramework[]]),
  effectiveFrom: z.string().min(1, "Select an effective date"),
  innerHorizontal: z.object({ heightM: num(0, 1000), radiusM: num(0, 20000) }),
  conical: z.object({ slope: num(0, 1), heightM: num(0, 1000) }),
  approach: z.object({
    innerEdgeDistM: num(0, 10000),
    innerHalfWidthM: num(0, 5000),
    divergence: num(0, 1),
    totalLengthM: num(0, 50000),
    sections: z.array(z.object({ lengthM: num(0, 50000), slope: num(0, 1) })).min(1).max(6),
  }),
  takeoffClimb: z.object({
    innerHalfWidthM: num(0, 5000),
    divergence: num(0, 1),
    slope: num(0, 1),
    totalLengthM: num(0, 50000),
  }),
  transitional: z.object({ slope: num(0, 1), stripHalfWidthM: num(0, 5000) }),
  cnsLimitAmslM: z.number().min(0).max(5000).nullable(),
  pansOpsLimitAmslM: z.number().min(0).max(5000).nullable(),
});
type FormValues = z.infer<typeof schema>;

// Compact numeric field bound to a nested RHF path. Defined at module scope so
// its identity is stable across renders (avoids input remount / focus loss).
function NumField({
  name,
  label,
  register,
  step = "any",
}: {
  name: Path<FormValues>;
  label: string;
  register: UseFormRegister<FormValues>;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`ols-${name}`} className="text-xs">{label}</Label>
      <Input
        id={`ols-${name}`}
        type="number"
        step={step}
        inputMode="decimal"
        className="h-8 tabular-nums"
        {...register(name, { valueAsNumber: true })}
      />
    </div>
  );
}

function paramsToForm(p: OlsParameters, effectiveFrom: string): FormValues {
  return {
    framework: p.framework as OlsFramework,
    effectiveFrom,
    innerHorizontal: { ...p.innerHorizontal },
    conical: { ...p.conical },
    approach: {
      innerEdgeDistM: p.approach.innerEdgeDistM,
      innerHalfWidthM: p.approach.innerHalfWidthM,
      divergence: p.approach.divergence,
      totalLengthM: p.approach.totalLengthM,
      sections: p.approach.sections.map((s) => ({ lengthM: s.lengthM, slope: s.slope })),
    },
    takeoffClimb: { ...p.takeoffClimb },
    transitional: { ...p.transitional },
    cnsLimitAmslM: p.cnsLimitAmslM,
    pansOpsLimitAmslM: p.pansOpsLimitAmslM,
  };
}

function formToParams(v: FormValues): OlsParameters {
  return {
    framework: v.framework,
    innerHorizontal: v.innerHorizontal,
    conical: v.conical,
    approach: {
      innerEdgeDistM: v.approach.innerEdgeDistM,
      innerHalfWidthM: v.approach.innerHalfWidthM,
      divergence: v.approach.divergence,
      totalLengthM: v.approach.totalLengthM,
      sections: v.approach.sections,
    },
    takeoffClimb: v.takeoffClimb,
    transitional: v.transitional,
    cnsLimitAmslM: v.cnsLimitAmslM,
    pansOpsLimitAmslM: v.pansOpsLimitAmslM,
  };
}

export function OlsParamsDialog({
  airportId,
  icao,
  source,
  nextVersion,
  open,
  onOpenChange,
}: {
  airportId: string;
  icao: string;
  source: OlsParameters;
  nextVersion: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: paramsToForm(source, today),
  });
  const { register, control, formState, watch, setValue } = form;
  const sections = useFieldArray({ control, name: "approach.sections" });

  const [jsonText, setJsonText] = React.useState("");
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      form.reset(paramsToForm(source, today));
      setJsonText("");
      setJsonError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const applyJson = () => {
    setJsonError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setJsonError("Not valid JSON.");
      return;
    }
    try {
      const framework = (parsed as { framework?: string }).framework;
      const candidate = schema.safeParse(
        paramsToForm(
          { ...(parsed as OlsParameters), framework: (framework as OlsFramework) ?? "ANNEX14_CLASSIC" },
          watch("effectiveFrom") || today
        )
      );
      if (!candidate.success) {
        setJsonError("JSON does not match the OLS parameter shape.");
        return;
      }
      form.reset(candidate.data);
      toast.success("JSON loaded into the form");
    } catch {
      setJsonError("JSON is missing required OLS parameter fields.");
    }
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      fetchJson("/api/master-data/ols-params", jsonBody({
        airportId,
        effectiveFrom: values.effectiveFrom,
        framework: values.framework,
        json: formToParams(values),
      })),
    onSuccess: () => {
      toast.success(`OLS parameters v${nextVersion} created`, {
        description: "Created inactive. Review, then Activate to apply it to evaluations.",
      });
      queryClient.invalidateQueries({ queryKey: ["md-airport", airportId] });
      queryClient.invalidateQueries({ queryKey: ["md-airports"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  const cns = watch("cnsLimitAmslM");
  const pansOps = watch("pansOpsLimitAmslM");

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-5 text-primary" aria-hidden />
            New OLS parameters — {icao} (v{nextVersion})
          </DialogTitle>
          <DialogDescription>
            Cloned from the current active version. Adjust the key surface values below.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-warning/30 bg-warning/10 text-warning [&>svg]:text-warning">
          <AlertTriangle aria-hidden />
          <AlertTitle>Reference — confirm against CAAB AIP</AlertTitle>
          <AlertDescription className="text-warning/90">
            These are safeguarding surface parameters. The new version is created inactive; it
            only affects evaluations once you activate it (a separate, confirmed step).
          </AlertDescription>
        </Alert>

        <form id="ols-params-form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ols-framework">Framework</Label>
              <Controller
                control={control}
                name="framework"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="ols-framework">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OLS_FRAMEWORKS.map((f) => (
                        <SelectItem key={f} value={f}>{FRAMEWORK_LABELS[f]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ols-effective">Effective from</Label>
              <Input id="ols-effective" type="date" aria-invalid={!!formState.errors.effectiveFrom} {...register("effectiveFrom")} />
              {formState.errors.effectiveFrom && (
                <p className="text-sm text-destructive" role="alert">{formState.errors.effectiveFrom.message}</p>
              )}
            </div>
          </div>

          <Accordion type="multiple" defaultValue={["ih", "approach"]} className="rounded-lg border px-3">
            <AccordionItem value="ih">
              <AccordionTrigger>Inner horizontal &amp; conical</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumField name="innerHorizontal.heightM" label="Inner horizontal height (m)" register={register} />
                  <NumField name="innerHorizontal.radiusM" label="Inner horizontal radius (m)" register={register} />
                  <NumField name="conical.slope" label="Conical slope (rise/run)" register={register} />
                  <NumField name="conical.heightM" label="Conical height (m)" register={register} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="approach">
              <AccordionTrigger>Approach surface</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumField name="approach.innerEdgeDistM" label="Inner edge distance (m)" register={register} />
                  <NumField name="approach.innerHalfWidthM" label="Inner half-width (m)" register={register} />
                  <NumField name="approach.divergence" label="Divergence (each side)" register={register} />
                  <NumField name="approach.totalLengthM" label="Total length (m)" register={register} />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Sections (piecewise slope)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => sections.append({ lengthM: 0, slope: 0 })}
                      disabled={sections.fields.length >= 6}
                    >
                      <Plus className="size-3.5" aria-hidden />
                      Add section
                    </Button>
                  </div>
                  {sections.fields.map((f, i) => (
                    <div key={f.id} className="flex items-end gap-2 rounded-md border p-2">
                      <span className="pb-2 text-xs text-muted-foreground w-6">#{i + 1}</span>
                      <NumField name={`approach.sections.${i}.lengthM`} label="Length (m)" register={register} />
                      <NumField name={`approach.sections.${i}.slope`} label="Slope" register={register} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mb-1 text-destructive"
                        onClick={() => sections.remove(i)}
                        disabled={sections.fields.length <= 1}
                        aria-label={`Remove section ${i + 1}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="toc">
              <AccordionTrigger>Take-off climb surface</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumField name="takeoffClimb.innerHalfWidthM" label="Inner half-width (m)" register={register} />
                  <NumField name="takeoffClimb.divergence" label="Divergence (each side)" register={register} />
                  <NumField name="takeoffClimb.slope" label="Slope (rise/run)" register={register} />
                  <NumField name="takeoffClimb.totalLengthM" label="Total length (m)" register={register} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="trans">
              <AccordionTrigger>Transitional surface</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumField name="transitional.slope" label="Transitional slope (rise/run)" register={register} />
                  <NumField name="transitional.stripHalfWidthM" label="Strip half-width (m)" register={register} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="limits">
              <AccordionTrigger>CNS &amp; PANS-OPS limits</AccordionTrigger>
              <AccordionContent>
                <p className="mb-3 text-xs text-muted-foreground">
                  Governing AMSL limits. Leave blank if the domain does not impose a limit at this airport.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ols-cns" className="text-xs">CNS limit (m AMSL)</Label>
                    <Input
                      id="ols-cns"
                      type="number"
                      step="any"
                      inputMode="decimal"
                      className="h-8 tabular-nums"
                      value={cns ?? ""}
                      onChange={(e) => setValue("cnsLimitAmslM", e.target.value === "" ? null : Number(e.target.value), { shouldValidate: true })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ols-pansops" className="text-xs">PANS-OPS limit (m AMSL)</Label>
                    <Input
                      id="ols-pansops"
                      type="number"
                      step="any"
                      inputMode="decimal"
                      className="h-8 tabular-nums"
                      value={pansOps ?? ""}
                      onChange={(e) => setValue("pansOpsLimitAmslM", e.target.value === "" ? null : Number(e.target.value), { shouldValidate: true })}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="json">
              <AccordionTrigger>Import from JSON (advanced)</AccordionTrigger>
              <AccordionContent>
                <p className="mb-2 text-xs text-muted-foreground">
                  Paste a full OLS parameter object and load it into the form above.
                </p>
                <Textarea
                  rows={5}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder='{"framework":"ANNEX14_CLASSIC","innerHorizontal":{...}}'
                  className="font-mono text-xs"
                />
                {jsonError && <p className="mt-1 text-sm text-destructive" role="alert">{jsonError}</p>}
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={applyJson} disabled={!jsonText.trim()}>
                  Load into form
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="ols-params-form" disabled={!formState.isValid || mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {mutation.isPending ? t("common.saving") : `Create v${nextVersion}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
