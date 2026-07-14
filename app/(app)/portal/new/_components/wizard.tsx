"use client";

/**
 * New-application wizard — 5 animated steps:
 *   1 Applicant · 2 Site (map picker + live check) · 3 Structure ·
 *   4 Documents (drag-drop upload) · 5 Review & submit.
 * A DRAFT is created server-side on entering step 4 so uploads can attach to it;
 * submit finalises the full payload and routes to the approving authority.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  Send,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { PageTransition } from "@/components/motion";
import { StatusBadge } from "@/components/shared/status-badge";
import { OlsMap, OlsLegend, type SiteStatus } from "@/components/map/ols-map";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/components/providers";
import { formatCoords, formatMetres } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WizardStepper } from "../../_components/stepper";
import { FileDropzone } from "../../_components/file-dropzone";
import {
  DOC_TYPE_META,
  REQUIRED_DOC_TYPES,
  STRUCTURE_TYPES,
  fetchJson,
  round6,
  uploadDocument,
  type AirportOption,
  type AuthorityOption,
  type EvaluateResponse,
  type LiveEvalResult,
  type OlsPayload,
  type PortalDocType,
  type UploadedDoc,
} from "../../_components/types";
import { STEP_FIELDS, STEP_LABELS, wizardSchema, type WizardValues } from "./schema";

const STEPS = STEP_LABELS.map((label) => ({ label }));

export function NewApplicationWizard({
  sessionUser,
}: {
  sessionUser: { name: string; email: string; orgName: string | null };
}) {
  const t = useT();
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [draftId, setDraftId] = React.useState<string | null>(null);
  const [creatingDraft, setCreatingDraft] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [docs, setDocs] = React.useState<Record<PortalDocType, UploadedDoc[]>>({
    OWNERSHIP: [],
    SITE_PLAN: [],
    ELEVATION_CERT: [],
    MOUZA_MAP: [],
    OTHER: [],
  });
  const [uploading, setUploading] = React.useState<PortalDocType | null>(null);
  const [uploadPct, setUploadPct] = React.useState<number | null>(null);

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    mode: "onChange",
    defaultValues: {
      contactPerson: "",
      contactPhone: "",
      contactEmail: sessionUser.email ?? "",
      icao: "",
      siteAddress: "",
      structureType: "",
      purpose: "",
      authorityOrgId: "",
      declaration: false,
    },
  });

  const icao = form.watch("icao");
  const lat = form.watch("lat");
  const lon = form.watch("lon");
  const groundElevationM = form.watch("groundElevationM");
  const requestedHeightAglM = form.watch("requestedHeightAglM");
  const structureType = form.watch("structureType");

  // ── Reference data ──
  const airportsQuery = useQuery<AirportOption[]>({
    queryKey: ["airports"],
    queryFn: () => fetchJson<AirportOption[]>("/api/airports"),
    staleTime: 5 * 60_000,
  });

  const olsQuery = useQuery<OlsPayload>({
    queryKey: ["ols", icao],
    queryFn: () => fetchJson<OlsPayload>(`/api/airports/${icao}/ols`),
    enabled: !!icao,
    staleTime: 10 * 60_000,
  });

  const authoritiesQuery = useQuery<AuthorityOption[]>({
    queryKey: ["authorities", icao],
    queryFn: () =>
      fetchJson<AuthorityOption[]>(`/api/portal/applications?authorities=1&icao=${icao}`),
    enabled: !!icao && step >= 4,
    staleTime: 5 * 60_000,
  });

  // When the airport changes, centre the site near the ARP and prefill ground elev.
  const selectedAirport = airportsQuery.data?.find((a) => a.icao === icao);
  React.useEffect(() => {
    if (!selectedAirport) return;
    if (lat == null || lon == null) {
      // drop the initial marker ~2 km NE of the reference point
      form.setValue("lat", round6(selectedAirport.referenceLat + 0.014), { shouldValidate: true });
      form.setValue("lon", round6(selectedAirport.referenceLon + 0.014), { shouldValidate: true });
    }
    if (groundElevationM == null) {
      form.setValue("groundElevationM", selectedAirport.elevationM, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAirport?.icao]);

  // ── Live indicative evaluation (debounced) ──
  const [liveEval, setLiveEval] = React.useState<LiveEvalResult | null>(null);
  const [evaluating, setEvaluating] = React.useState(false);
  React.useEffect(() => {
    if (!icao || lat == null || lon == null || groundElevationM == null) {
      setLiveEval(null);
      return;
    }
    const probeHeight = requestedHeightAglM && requestedHeightAglM > 0 ? requestedHeightAglM : 10;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setEvaluating(true);
      try {
        const res = await fetchJson<EvaluateResponse>("/api/evaluate", {
          method: "POST",
          signal: controller.signal,
          body: JSON.stringify({
            icao,
            lat,
            lon,
            groundElevationM,
            requestedHeightAglM: probeHeight,
          }),
        });
        setLiveEval(res.result);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setLiveEval(null);
      } finally {
        setEvaluating(false);
      }
    }, 450);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [icao, lat, lon, groundElevationM, requestedHeightAglM]);

  const siteStatus: SiteStatus = liveEval?.status ?? "NONE";
  const permissible = liveEval?.permissibleAglM ?? null;
  const exceedsPermissible =
    permissible != null && requestedHeightAglM != null && requestedHeightAglM > permissible;

  // ── Step navigation ──
  const goNext = async () => {
    const fields = STEP_FIELDS[step];
    const valid = fields.length === 0 ? true : await form.trigger(fields);
    if (!valid) return;

    // Create the draft when leaving Structure (step 2) → Documents (step 3)
    if (step === 2 && !draftId) {
      setCreatingDraft(true);
      try {
        const v = form.getValues();
        const created = await fetchJson<{ id: string; refNo: string }>(
          "/api/portal/applications",
          {
            method: "POST",
            body: JSON.stringify({
              icao: v.icao,
              lat: v.lat,
              lon: v.lon,
              groundElevationM: v.groundElevationM,
              requestedHeightAglM: v.requestedHeightAglM,
              structureType: v.structureType,
              siteAddress: v.siteAddress,
              contactPerson: v.contactPerson,
              contactPhone: v.contactPhone,
              contactEmail: v.contactEmail,
              purpose: v.purpose || undefined,
            }),
          }
        );
        setDraftId(created.id);
        toast.success("Draft saved", { description: `${created.refNo} — you can now attach documents.` });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("common.error"));
        setCreatingDraft(false);
        return;
      }
      setCreatingDraft(false);
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  // ── Document upload ──
  const handleUpload = async (type: PortalDocType, file: File) => {
    if (!draftId) {
      toast.error("Save the draft first");
      return;
    }
    setUploading(type);
    setUploadPct(0);
    try {
      const uploaded = await uploadDocument({
        file,
        type,
        applicationId: draftId,
        onProgress: setUploadPct,
      });
      setDocs((prev) => ({ ...prev, [type]: [uploaded, ...prev[type]] }));
      toast.success("Document uploaded", { description: uploaded.filename });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
      setUploadPct(null);
    }
  };

  const missingRequiredDocs = REQUIRED_DOC_TYPES.filter((tpe) => docs[tpe].length === 0);

  // ── Submit ──
  const onSubmit = async (values: WizardValues) => {
    if (!draftId) {
      toast.error("Draft not created");
      return;
    }
    if (missingRequiredDocs.length > 0) {
      toast.error("Missing required documents", {
        description: missingRequiredDocs.map((d) => DOC_TYPE_META[d].label).join(", "),
      });
      setStep(3);
      return;
    }
    setSubmitting(true);
    try {
      await fetchJson<{ id: string; refNo: string; status: string }>(
        `/api/portal/applications/${draftId}/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            icao: values.icao,
            lat: values.lat,
            lon: values.lon,
            groundElevationM: values.groundElevationM,
            requestedHeightAglM: values.requestedHeightAglM,
            structureType: values.structureType,
            siteAddress: values.siteAddress,
            authorityOrgId: values.authorityOrgId,
            contactPerson: values.contactPerson,
            contactPhone: values.contactPhone,
            contactEmail: values.contactEmail,
            purpose: values.purpose || undefined,
            declaration: true,
          }),
        }
      );
      toast.success("Application submitted", {
        description: "Routed to your approving authority for endorsement.",
      });
      router.push(`/portal/applications/${draftId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
      setSubmitting(false);
    }
  };

  const requestedTop =
    groundElevationM != null && requestedHeightAglM != null
      ? Math.round((groundElevationM + requestedHeightAglM) * 100) / 100
      : null;

  return (
    <PageTransition>
      <PageHeader
        title={t("application.newApplication")}
        description="Apply for aviation height clearance. Your application is routed to the relevant approving authority, then to CAAB for OLS evaluation and decision."
        crumbs={[
          { label: t("nav.home"), href: "/portal" },
          { label: t("application.newApplication") },
        ]}
      />

      <WizardStepper steps={STEPS} current={step} onStepClick={(i) => i < step && setStep(i)} className="mb-6" />

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* ── Step 1 — Applicant ── */}
            {step === 0 && (
              <Card className="p-5">
                <h2 className="text-base font-semibold">{t("application.applicant")}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Applying as <span className="font-medium text-foreground">{sessionUser.orgName ?? sessionUser.name}</span>.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Contact person" error={form.formState.errors.contactPerson?.message} required>
                    <Input placeholder="Full name" {...form.register("contactPerson")} aria-invalid={!!form.formState.errors.contactPerson} />
                  </Field>
                  <Field label="Contact phone" error={form.formState.errors.contactPhone?.message} required>
                    <Input placeholder="+8801XXXXXXXXX" {...form.register("contactPhone")} aria-invalid={!!form.formState.errors.contactPhone} />
                  </Field>
                  <Field label="Contact email" error={form.formState.errors.contactEmail?.message} required className="sm:col-span-2">
                    <Input type="email" placeholder="you@company.com.bd" {...form.register("contactEmail")} aria-invalid={!!form.formState.errors.contactEmail} />
                  </Field>
                </div>
              </Card>
            )}

            {/* ── Step 2 — Site ── */}
            {step === 1 && (
              <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                <Card className="overflow-hidden p-0">
                  <div className="border-b p-3">
                    <Field label={t("common.airport")} error={form.formState.errors.icao?.message} required>
                      <Controller
                        control={form.control}
                        name="icao"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full" aria-invalid={!!form.formState.errors.icao}>
                              <SelectValue placeholder="Select the nearest airport" />
                            </SelectTrigger>
                            <SelectContent>
                              {airportsQuery.data?.map((a) => (
                                <SelectItem key={a.icao} value={a.icao}>
                                  {a.icao} — {a.name} ({a.city})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                  </div>
                  {icao ? (
                    <OlsMap
                      className="h-[380px] w-full"
                      center={
                        selectedAirport
                          ? [selectedAirport.referenceLon, selectedAirport.referenceLat]
                          : [90.4, 23.8]
                      }
                      surfaces={olsQuery.data?.surfaces ?? null}
                      runways={olsQuery.data?.runways ?? null}
                      navaids={olsQuery.data?.navaids}
                      site={lat != null && lon != null ? { lat, lon } : null}
                      siteStatus={siteStatus}
                      siteDraggable
                      onSiteChange={(p) => {
                        form.setValue("lat", round6(p.lat), { shouldValidate: true });
                        form.setValue("lon", round6(p.lon), { shouldValidate: true });
                      }}
                      onMapClick={(p) => {
                        form.setValue("lat", round6(p.lat), { shouldValidate: true });
                        form.setValue("lon", round6(p.lon), { shouldValidate: true });
                      }}
                    />
                  ) : (
                    <div className="flex h-[380px] items-center justify-center text-sm text-muted-foreground">
                      <MapPin className="mr-2 size-4" aria-hidden /> Select an airport to place your site
                    </div>
                  )}
                  <div className="border-t p-2">
                    <OlsLegend />
                  </div>
                </Card>

                <div className="space-y-4">
                  <Card className="p-4">
                    <p className="text-sm font-medium">{t("application.site")}</p>
                    <p className="text-xs text-muted-foreground">Click or drag the marker, or type coordinates.</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Field label={t("public.latitude")} error={form.formState.errors.lat?.message} required>
                        <Input
                          type="number"
                          step="0.000001"
                          value={lat ?? ""}
                          onChange={(e) => form.setValue("lat", e.target.value === "" ? (undefined as unknown as number) : Number(e.target.value), { shouldValidate: true })}
                          aria-invalid={!!form.formState.errors.lat}
                        />
                      </Field>
                      <Field label={t("public.longitude")} error={form.formState.errors.lon?.message} required>
                        <Input
                          type="number"
                          step="0.000001"
                          value={lon ?? ""}
                          onChange={(e) => form.setValue("lon", e.target.value === "" ? (undefined as unknown as number) : Number(e.target.value), { shouldValidate: true })}
                          aria-invalid={!!form.formState.errors.lon}
                        />
                      </Field>
                    </div>
                    {lat != null && lon != null && (
                      <p className="mt-2 font-mono text-xs text-muted-foreground">{formatCoords(lat, lon)}</p>
                    )}
                    <div className="mt-3">
                      <Field label={t("public.groundElevation")} error={form.formState.errors.groundElevationM?.message} required>
                        <Input
                          type="number"
                          step="0.1"
                          value={groundElevationM ?? ""}
                          onChange={(e) => form.setValue("groundElevationM", e.target.value === "" ? (undefined as unknown as number) : Number(e.target.value), { shouldValidate: true })}
                          aria-invalid={!!form.formState.errors.groundElevationM}
                        />
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Field label={t("application.siteAddress")} error={form.formState.errors.siteAddress?.message} required>
                        <Textarea rows={2} placeholder="Plot, road, area, city" {...form.register("siteAddress")} aria-invalid={!!form.formState.errors.siteAddress} />
                      </Field>
                    </div>
                  </Card>

                  <LiveCheckPanel evaluating={evaluating} liveEval={liveEval} />
                </div>
              </div>
            )}

            {/* ── Step 3 — Structure ── */}
            {step === 2 && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <h2 className="text-base font-semibold">{t("application.structureType")}</h2>
                  <div className="mt-4 space-y-4">
                    <Field label={t("application.structureType")} error={form.formState.errors.structureType?.message} required>
                      <Controller
                        control={form.control}
                        name="structureType"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full" aria-invalid={!!form.formState.errors.structureType}>
                              <SelectValue placeholder="Select structure type" />
                            </SelectTrigger>
                            <SelectContent>
                              {STRUCTURE_TYPES.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                    <Field label={t("application.requestedHeight")} error={form.formState.errors.requestedHeightAglM?.message} required>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Metres above ground level"
                        value={requestedHeightAglM ?? ""}
                        onChange={(e) => form.setValue("requestedHeightAglM", e.target.value === "" ? (undefined as unknown as number) : Number(e.target.value), { shouldValidate: true })}
                        aria-invalid={!!form.formState.errors.requestedHeightAglM}
                      />
                    </Field>
                    {requestedTop != null && (
                      <p className="text-sm text-muted-foreground">
                        {t("application.requestedTop")}:{" "}
                        <span className="font-medium text-foreground tabular-nums">{formatMetres(requestedTop)} AMSL</span>
                      </p>
                    )}
                    <Field label="Purpose / notes" error={form.formState.errors.purpose?.message}>
                      <Textarea rows={3} placeholder="Optional context for the reviewers" {...form.register("purpose")} />
                    </Field>
                  </div>
                </Card>

                <div className="space-y-4">
                  <LiveCheckPanel evaluating={evaluating} liveEval={liveEval} />
                  {exceedsPermissible && (
                    <Card className="border-warning/40 bg-warning/5 p-4">
                      <p className="flex items-center gap-2 text-sm font-medium text-warning">
                        <TriangleAlert className="size-4" aria-hidden /> Proposed height exceeds the indicative permissible height
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Your {formatMetres(requestedHeightAglM)} exceeds the indicative permissible {formatMetres(permissible)} AGL at this
                        site. You may still apply — CAAB may raise an objection, propose a lower permissible height, or refer the case to an
                        aeronautical study.
                      </p>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 4 — Documents ── */}
            {step === 3 && (
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">{t("application.documents")}</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Attach the required supporting documents. PDF, PNG or JPEG · max 5 MB each.
                    </p>
                  </div>
                  {creatingDraft && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden /> Saving draft…
                    </span>
                  )}
                </div>
                <div className="mt-4 grid gap-3">
                  {(["OWNERSHIP", "SITE_PLAN", "ELEVATION_CERT", "MOUZA_MAP", "OTHER"] as PortalDocType[]).map((type) => (
                    <FileDropzone
                      key={type}
                      label={DOC_TYPE_META[type].label}
                      hint={DOC_TYPE_META[type].hint}
                      required={REQUIRED_DOC_TYPES.includes(type)}
                      disabled={!draftId || uploading !== null}
                      uploading={uploading === type}
                      progress={uploading === type ? uploadPct : null}
                      documents={docs[type]}
                      onFile={(file) => handleUpload(type, file)}
                    />
                  ))}
                </div>
                {missingRequiredDocs.length > 0 && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TriangleAlert className="size-3.5 text-warning" aria-hidden />
                    Still required: {missingRequiredDocs.map((d) => DOC_TYPE_META[d].label).join(", ")}
                  </p>
                )}
              </Card>
            )}

            {/* ── Step 5 — Review & submit ── */}
            {step === 4 && (
              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <Card className="p-5">
                  <h2 className="text-base font-semibold">Review &amp; submit</h2>
                  <dl className="mt-4 divide-y text-sm">
                    <Row label={t("application.applicant")} value={sessionUser.orgName ?? sessionUser.name} />
                    <Row label="Contact" value={`${form.getValues("contactPerson")} · ${form.getValues("contactPhone")}`} />
                    <Row label={t("common.airport")} value={selectedAirport ? `${selectedAirport.icao} — ${selectedAirport.name}` : icao} />
                    <Row label={t("application.coordinates")} value={lat != null && lon != null ? formatCoords(lat, lon) : "—"} />
                    <Row label={t("application.site")} value={form.getValues("siteAddress")} />
                    <Row label={t("application.structureType")} value={structureType} />
                    <Row label={t("application.requestedHeight")} value={`${formatMetres(requestedHeightAglM)} · top ${formatMetres(requestedTop)} AMSL`} />
                    <Row label={t("application.documents")} value={`${REQUIRED_DOC_TYPES.filter((tp) => docs[tp].length).length}/${REQUIRED_DOC_TYPES.length} required attached`} />
                  </dl>

                  <div className="mt-5 space-y-4">
                    <Field label={t("application.authority")} error={form.formState.errors.authorityOrgId?.message} required>
                      <Controller
                        control={form.control}
                        name="authorityOrgId"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange} disabled={authoritiesQuery.isLoading}>
                            <SelectTrigger className="w-full" aria-invalid={!!form.formState.errors.authorityOrgId}>
                              <SelectValue placeholder={authoritiesQuery.isLoading ? t("common.loading") : "Select the approving authority"} />
                            </SelectTrigger>
                            <SelectContent>
                              {authoritiesQuery.data?.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.name}{a.city ? ` — ${a.city}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>

                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm">
                      <Controller
                        control={form.control}
                        name="declaration"
                        render={({ field }) => (
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" aria-invalid={!!form.formState.errors.declaration} />
                        )}
                      />
                      <span className="text-muted-foreground">
                        I declare that the information provided is accurate and that the attached documents are genuine. I understand this
                        indicative check is not a clearance and that CAAB issues the authoritative determination.
                      </span>
                    </label>
                    {form.formState.errors.declaration && (
                      <p className="text-sm text-destructive" role="alert">{form.formState.errors.declaration.message}</p>
                    )}
                  </div>
                </Card>

                <LiveCheckPanel evaluating={evaluating} liveEval={liveEval} title="Indicative evaluation snapshot" />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Nav */}
        <div className="mt-6 flex items-center justify-between">
          <Button type="button" variant="outline" onClick={goBack} disabled={step === 0 || submitting}>
            <ArrowLeft className="size-4" aria-hidden /> {t("common.back")}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext} disabled={creatingDraft}>
              {creatingDraft && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {t("common.next")} <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button type="submit" disabled={submitting || !form.formState.isValid}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
              {submitting ? t("common.submitting") : t("common.submit")}
            </Button>
          )}
        </div>
      </form>
    </PageTransition>
  );
}

// ─────────────────────────── helpers ───────────────────────────

function Field({
  label,
  error,
  required,
  className,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>
        {label}
        {required && <span className="ml-1 text-destructive" aria-hidden>*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value || "—"}</dd>
    </div>
  );
}

function LiveCheckPanel({
  evaluating,
  liveEval,
  title = "Live indicative height check",
}: {
  evaluating: boolean;
  liveEval: LiveEvalResult | null;
  title?: string;
}) {
  const t = useT();
  const tone =
    liveEval?.status === "CLEAR"
      ? "border-success/40 bg-success/5"
      : liveEval?.status === "OBJECTION"
        ? "border-destructive/40 bg-destructive/5"
        : "border-border";
  return (
    <Card className={cn("p-4 transition-colors duration-300", tone)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        {evaluating && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
      </div>
      {!liveEval ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <StatusBadge status={liveEval.status} />
          {liveEval.status === "OUTSIDE" ? (
            <p className="text-sm text-muted-foreground">
              Outside the obstacle limitation surfaces ({formatMetres(liveEval.distanceToNearestRunwayM)} from the runway).
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t("public.permissibleHeight")}</dt>
              <dd className="text-right font-semibold tabular-nums">{formatMetres(liveEval.permissibleAglM)} AGL</dd>
              <dt className="text-muted-foreground">{t("public.permissibleTopElevation")}</dt>
              <dd className="text-right tabular-nums">{formatMetres(liveEval.ptE_amslM)} AMSL</dd>
              <dt className="text-muted-foreground">{t("public.governingSurface")}</dt>
              <dd className="text-right">{liveEval.governingSurface ?? "—"}</dd>
              {liveEval.penetrationM != null && liveEval.penetrationM > 0 && (
                <>
                  <dt className="text-muted-foreground">{t("public.penetration")}</dt>
                  <dd className="text-right font-semibold text-destructive tabular-nums">{formatMetres(liveEval.penetrationM)}</dd>
                </>
              )}
            </dl>
          )}
          <p className="pt-1 text-xs text-muted-foreground">{t("public.disclaimer")}</p>
        </div>
      )}
    </Card>
  );
}
