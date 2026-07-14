"use client";

/**
 * Aeronautical study workspace — penetration summary, shielding context
 * (nearby obstacles), and the study form (findings, proposed conditions,
 * outcome). Save draft or complete to advance the case to Decision Pending.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Layers,
  Loader2,
  MapPin,
  Plus,
  Save,
  ShieldQuestion,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageTransition, FadeIn } from "@/components/motion";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { OlsMap, OlsLegend, type SiteStatus } from "@/components/map/ols-map";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/components/providers";
import { formatMetres, formatCoords } from "@/lib/format";
import { fetchJson } from "@/app/(app)/applications/_components/api";
import { cn } from "@/lib/utils";
import { CONDITION_SUGGESTIONS, type StudyWorkspaceResponse } from "../../_components/types";

const schema = z
  .object({
    type: z.enum(["AERONAUTICAL", "SHIELDING"]),
    findings: z.string().trim().min(30, "Findings must be at least 30 characters").max(10000),
    conditions: z.array(z.object({ value: z.string().trim().min(1).max(300) })).max(20),
    outcome: z.enum(["PERMIT_WITH_CONDITIONS", "REFUSE"], { error: "Select an outcome" }),
  })
  .superRefine((data, ctx) => {
    if (data.outcome === "PERMIT_WITH_CONDITIONS" && data.conditions.length === 0) {
      ctx.addIssue({ code: "custom", path: ["conditions"], message: "Add at least one condition for a conditional permit" });
    }
  });

type FormValues = z.infer<typeof schema>;

export function StudyWorkspace({ studyId }: { studyId: string }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<StudyWorkspaceResponse>({
    queryKey: ["study", studyId],
    queryFn: () => fetchJson<StudyWorkspaceResponse>(`/api/studies/${studyId}`),
    retry: false,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { type: "AERONAUTICAL", findings: "", conditions: [], outcome: undefined },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "conditions" });

  // Hydrate the form once the study loads
  const hydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (!data || hydratedRef.current) return;
    hydratedRef.current = true;
    form.reset({
      type: data.study.type,
      findings: data.study.findings ?? "",
      conditions: data.study.proposedConditions.map((value) => ({ value })),
      outcome: data.study.outcome ?? undefined,
    });
  }, [data, form]);

  const saveDraft = useMutation({
    mutationFn: (values: FormValues) =>
      fetchJson(`/api/studies/${studyId}`, {
        method: "PATCH",
        body: JSON.stringify({
          type: values.type,
          findings: values.findings || undefined,
          proposedConditions: values.conditions.map((c) => c.value),
        }),
      }),
    onSuccess: () => {
      toast.success("Draft saved");
      queryClient.invalidateQueries({ queryKey: ["study", studyId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  const complete = useMutation({
    mutationFn: (values: FormValues) =>
      fetchJson<{ applicationStatus: string }>(`/api/studies/${studyId}/complete`, {
        method: "POST",
        body: JSON.stringify({
          type: values.type,
          findings: values.findings,
          proposedConditions: values.conditions.map((c) => c.value),
          outcome: values.outcome,
        }),
      }),
    onSuccess: () => {
      toast.success("Study completed", { description: "Case advanced to Decision Pending." });
      queryClient.invalidateQueries({ queryKey: ["studies"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      router.push("/studies");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  if (isLoading) {
    return (
      <PageTransition>
        <Skeleton className="mb-6 h-9 w-72" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[420px] w-full" />
          <Skeleton className="h-[420px] w-full" />
        </div>
      </PageTransition>
    );
  }

  if (error || !data) {
    return (
      <PageTransition>
        <EmptyState
          icon={TriangleAlert}
          title="Study unavailable"
          description={error instanceof Error ? error.message : "This study could not be loaded."}
          action={<Button asChild variant="outline"><Link href="/studies"><ArrowLeft className="size-4" aria-hidden /> Back to studies</Link></Button>}
        />
      </PageTransition>
    );
  }

  const { study, application, evaluation, nearbyObstacles, map, viewer } = data;
  const canEdit = viewer.canEdit;
  const siteStatus: SiteStatus = (evaluation?.status as SiteStatus) ?? "NONE";
  const outcome = form.watch("outcome");
  const busy = saveDraft.isPending || complete.isPending;

  return (
    <PageTransition>
      <PageHeader
        title="Study workspace"
        description={<>{application.refNo} · {application.structureType} · {application.airport.icao}</>}
        crumbs={[{ label: t("nav.studies"), href: "/studies" }, { label: application.refNo }]}
        actions={
          <>
            {study.outcome && (
              <StatusBadge status={study.outcome === "PERMIT_WITH_CONDITIONS" ? "APPROVED" : "REJECTED"} showDot={false} />
            )}
            <Button asChild variant="outline"><Link href={`/applications/${application.id}`}>Open full case</Link></Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Left: map + penetration + shielding */}
        <div className="space-y-4">
          <Card className="overflow-hidden p-0">
            {map ? (
              <OlsMap
                className="h-[320px] w-full"
                center={map.center}
                surfaces={map.surfaces}
                runways={map.runways}
                site={{ lat: application.lat, lon: application.lon }}
                siteStatus={siteStatus}
                obstacles={nearbyObstacles.map((o) => ({
                  lat: o.lat,
                  lon: o.lon,
                  status: o.status,
                  label: o.name ?? o.structureType,
                }))}
                interactive
              />
            ) : (
              <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                <MapPin className="mr-2 size-4" aria-hidden /> Map unavailable
              </div>
            )}
            <div className="border-t p-2"><OlsLegend /></div>
          </Card>

          {/* Penetration summary */}
          <Card className="p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <TriangleAlert className="size-4 text-destructive" aria-hidden /> Penetration summary
            </h3>
            {evaluation ? (
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">{t("application.requestedTop")}</dt>
                <dd className="text-right font-medium tabular-nums">{formatMetres(application.requestedTopElevationAmslM)} AMSL</dd>
                <dt className="text-muted-foreground">{t("public.permissibleTopElevation")}</dt>
                <dd className="text-right tabular-nums">{formatMetres(evaluation.ptE_amslM)} AMSL</dd>
                <dt className="text-muted-foreground">{t("public.governingSurface")}</dt>
                <dd className="text-right">{evaluation.governingSurface ?? "—"}</dd>
                <dt className="text-muted-foreground">{t("public.penetration")}</dt>
                <dd className={cn("text-right font-semibold tabular-nums", (evaluation.penetrationM ?? 0) > 0 && "text-destructive")}>
                  {(evaluation.penetrationM ?? 0) > 0 ? formatMetres(evaluation.penetrationM) : t("common.none")}
                </dd>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No stored evaluation.</p>
            )}
          </Card>

          {/* Shielding context */}
          <Card className="p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="size-4 text-primary" aria-hidden /> Shielding context
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Existing structures within ~1 km — a taller nearby obstacle may shield the site.
            </p>
            {nearbyObstacles.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No registered obstacles nearby.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {nearbyObstacles.map((o) => {
                  const shields =
                    application.requestedTopElevationAmslM != null &&
                    o.topElevationAmslM >= application.requestedTopElevationAmslM;
                  return (
                    <li key={o.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{o.name ?? o.structureType}</span>
                        <span className="text-xs text-muted-foreground">{o.distanceM} m away · {formatMetres(o.topElevationAmslM)} AMSL</span>
                      </span>
                      {shields ? (
                        <Badge variant="secondary" className="shrink-0 text-success">Shields</Badge>
                      ) : (
                        <StatusBadge status={o.status} showDot={false} className="shrink-0" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* Right: study form */}
        <div className="space-y-4">
          <FadeIn>
            <Card className="p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="size-4 text-primary" aria-hidden /> Case
              </h3>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("application.applicant")}</dt><dd className="text-right font-medium">{application.applicantOrg.name}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("common.airport")}</dt><dd className="text-right font-medium">{application.airport.icao} — {application.airport.name}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("application.structureType")}</dt><dd className="text-right font-medium">{application.structureType}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("application.coordinates")}</dt><dd className="text-right font-medium font-mono text-xs">{formatCoords(application.lat, application.lon)}</dd></div>
              </dl>
            </Card>
          </FadeIn>

          <Card className="p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldQuestion className="size-4 text-primary" aria-hidden /> Study assessment
            </h3>

            {!canEdit && (
              <p className="mt-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {study.outcome
                  ? `This study is complete (${study.outcome === "PERMIT_WITH_CONDITIONS" ? "permit with conditions" : "refuse"}). Shown read-only.`
                  : "Read-only — you are viewing this study without edit rights."}
              </p>
            )}

            <form
              className="mt-3 space-y-4"
              onSubmit={form.handleSubmit((v) => complete.mutate(v))}
            >
              <fieldset disabled={!canEdit || busy} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Study type</Label>
                  <Controller
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AERONAUTICAL">Aeronautical study</SelectItem>
                          <SelectItem value="SHIELDING">Shielding assessment</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="findings">Findings <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="findings"
                    rows={5}
                    placeholder="Assess operational impact: terrain clearance, circling protection, shielding by existing structures, procedure design implications…"
                    aria-invalid={!!form.formState.errors.findings}
                    {...form.register("findings")}
                  />
                  {form.formState.errors.findings && (
                    <p className="text-xs text-destructive" role="alert">{form.formState.errors.findings.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Proposed conditions</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ value: "" })} disabled={!canEdit || busy}>
                      <Plus className="size-3.5" aria-hidden /> Add
                    </Button>
                  </div>
                  {fields.length === 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {CONDITION_SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => append({ value: s })}
                          className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 disabled:opacity-50"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {fields.map((f, i) => (
                    <div key={f.id} className="flex items-center gap-2">
                      <Input {...form.register(`conditions.${i}.value`)} placeholder={`Condition ${i + 1}`} />
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(i)} disabled={!canEdit || busy} aria-label="Remove condition">
                        <X className="size-4" aria-hidden />
                      </Button>
                    </div>
                  ))}
                  {form.formState.errors.conditions && (
                    <p className="text-xs text-destructive" role="alert">{form.formState.errors.conditions.message as string}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Outcome <span className="text-destructive">*</span></Label>
                  <Controller
                    control={form.control}
                    name="outcome"
                    render={({ field }) => (
                      <RadioGroup value={field.value ?? ""} onValueChange={field.onChange} className="gap-2">
                        <label className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors", outcome === "PERMIT_WITH_CONDITIONS" ? "border-success/50 bg-success/5" : "hover:bg-accent/50")}>
                          <RadioGroupItem value="PERMIT_WITH_CONDITIONS" className="mt-0.5" />
                          <span>
                            <span className="flex items-center gap-1.5 text-sm font-medium"><CheckCircle2 className="size-4 text-success" aria-hidden /> Permit with conditions</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">Recommend approval subject to the conditions above (merged into the certificate).</span>
                          </span>
                        </label>
                        <label className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors", outcome === "REFUSE" ? "border-destructive/50 bg-destructive/5" : "hover:bg-accent/50")}>
                          <RadioGroupItem value="REFUSE" className="mt-0.5" />
                          <span>
                            <span className="flex items-center gap-1.5 text-sm font-medium"><XCircle className="size-4 text-destructive" aria-hidden /> Refuse</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">Recommend refusal — the penetration cannot be safely accommodated.</span>
                          </span>
                        </label>
                      </RadioGroup>
                    )}
                  />
                  {form.formState.errors.outcome && (
                    <p className="text-xs text-destructive" role="alert">{form.formState.errors.outcome.message}</p>
                  )}
                </div>
              </fieldset>

              {canEdit && (
                <div className="flex items-center justify-end gap-2 border-t pt-3">
                  <Button type="button" variant="outline" onClick={() => saveDraft.mutate(form.getValues())} disabled={busy}>
                    {saveDraft.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
                    Save draft
                  </Button>
                  <Button type="submit" disabled={busy || !form.formState.isValid}>
                    {complete.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
                    Complete study
                  </Button>
                </div>
              )}
            </form>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
