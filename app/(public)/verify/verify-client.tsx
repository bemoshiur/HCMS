"use client";

/**
 * Public certificate verification — HC number or QR token.
 * GET /api/verify?code=... → { valid, certificate? } (route owned by the
 * certificate module; UI built against that contract).
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  FileSearch,
  Printer,
  QrCode,
  Search,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { PageTransition, AnimatePresence, motion, SPRING_SOFT } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/components/providers";
import { formatCoords, formatDate, formatDateTime, formatMetres } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─────────────────────────── contract ───────────────────────────

interface VerifiedCertificate {
  hcNo: string;
  status: string; // ISSUED | REVOKED | EXPIRED | SUPERSEDED
  decision: string; // GRANTED | OBJECTION
  applicantName: string;
  authorityName: string;
  airport: { icao: string; name: string };
  lat: number;
  lon: number;
  siteAddress: string;
  ptE_amslM: number;
  permissibleAglM: number;
  governingSurface: string | null;
  conditions: string[];
  validFrom: string;
  validTo: string;
  issuedAt: string;
  signedByName: string | null;
}

interface VerifyResponse {
  valid: boolean;
  certificate?: VerifiedCertificate;
}

const schema = z.object({
  code: z.string().trim().min(4, "Enter the HC number or QR token"),
});
type FormValues = z.infer<typeof schema>;

// ─────────────────────────── component ───────────────────────────

export function VerifyClient({ initialCode }: { initialCode?: string }) {
  const t = useT();
  const router = useRouter();
  const [submittedCode, setSubmittedCode] = React.useState(initialCode ?? "");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { code: initialCode ?? "" },
  });

  const verifyQuery = useQuery<VerifyResponse>({
    queryKey: ["verify", submittedCode],
    queryFn: async () => {
      const res = await fetch(`/api/verify?code=${encodeURIComponent(submittedCode)}`);
      const json = (await res.json().catch(() => null)) as VerifyResponse | null;
      if (json && typeof json.valid === "boolean") return json;
      if (!res.ok) throw new Error("Verification service unavailable");
      return { valid: false };
    },
    enabled: submittedCode.length >= 4,
    retry: 1,
  });

  const onSubmit = form.handleSubmit(({ code }) => {
    const trimmed = code.trim();
    setSubmittedCode(trimmed);
    router.replace(`/verify?code=${encodeURIComponent(trimmed)}`, { scroll: false });
  });

  const data = verifyQuery.data;
  const showResult = submittedCode.length >= 4 && (data || verifyQuery.isError);

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PageHeader
          crumbs={[{ label: t("nav.home"), href: "/" }, { label: t("nav.verifyCertificate") }]}
          title={t("public.verifyTitle")}
          description={t("public.verifySubtitle")}
          className="print:hidden"
        />

        {/* Lookup form */}
        <Card className="gap-4 p-5 print:hidden">
          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="verify-code">{t("public.hcNumber")}</Label>
              <div className="relative">
                <FileSearch
                  className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="verify-code"
                  placeholder="HC-2026-0001"
                  className="pl-8 font-mono"
                  autoComplete="off"
                  aria-invalid={!!form.formState.errors.code}
                  {...form.register("code")}
                />
              </div>
              {form.formState.errors.code && (
                <p role="alert" className="text-xs text-destructive">
                  {form.formState.errors.code.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={!form.formState.isValid || verifyQuery.isFetching}>
              <Search className="size-4" aria-hidden />
              {verifyQuery.isFetching ? t("common.loading") : t("public.verify")}
            </Button>
          </form>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <QrCode className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Scanning the QR code on a certificate opens this page with the code pre-filled.
          </p>
        </Card>

        {/* Result */}
        <div className="mt-6" aria-live="polite">
          {verifyQuery.isFetching ? (
            <Card className="gap-4 p-6" aria-busy="true">
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-3.5 w-72" />
                </div>
              </div>
              <Skeleton className="h-40 w-full" />
            </Card>
          ) : showResult ? (
            <AnimatePresence mode="wait">
              {data?.valid && data.certificate ? (
                <ValidResult key={data.certificate.hcNo} certificate={data.certificate} />
              ) : (
                <InvalidResult key="invalid" code={submittedCode} />
              )}
            </AnimatePresence>
          ) : null}
        </div>
      </div>
    </PageTransition>
  );
}

// ─────────────────────────── results ───────────────────────────

function ValidResult({ certificate }: { certificate: VerifiedCertificate }) {
  const t = useT();
  const granted = certificate.decision === "GRANTED";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="gap-0 overflow-hidden p-0">
        {/* Verification banner */}
        <div className="flex flex-wrap items-center gap-3 border-b bg-success/10 px-5 py-4">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={SPRING_SOFT}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
          >
            <ShieldCheck className="size-6" aria-hidden />
          </motion.span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-success">{t("public.certValid")}</p>
            <p className="text-xs text-muted-foreground">
              {t("cert.title")} · {t("cert.hcNo")}{" "}
              <span className="font-mono font-medium text-foreground">{certificate.hcNo}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={certificate.status} />
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                granted
                  ? "border-success/25 bg-success/10 text-success"
                  : "border-destructive/25 bg-destructive/10 text-destructive"
              )}
            >
              <BadgeCheck className="size-3.5" aria-hidden />
              {granted ? t("cert.granted") : t("cert.objection")}
            </span>
          </div>
        </div>

        {/* Certificate summary */}
        <div className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
          <Field label={t("cert.issuedTo")} value={certificate.applicantName} />
          <Field label={t("cert.throughAuthority")} value={certificate.authorityName} />
          <Field
            label={t("common.airport")}
            value={`${certificate.airport.icao} — ${certificate.airport.name}`}
          />
          <Field
            label={t("cert.location")}
            value={
              <>
                {certificate.siteAddress}
                <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                  {formatCoords(certificate.lat, certificate.lon)}
                </span>
              </>
            }
          />
          <Field
            label={t("public.permissibleTopElevation")}
            value={`${formatMetres(certificate.ptE_amslM)} AMSL`}
          />
          <Field
            label={t("public.permissibleHeight")}
            value={`${formatMetres(certificate.permissibleAglM)} AGL`}
          />
          <Field
            label={t("public.governingSurface")}
            value={certificate.governingSurface ?? "—"}
          />
          <Field
            label={t("cert.validity")}
            value={`${formatDate(certificate.validFrom)} — ${formatDate(certificate.validTo)}`}
          />
        </div>

        {certificate.conditions.length > 0 && (
          <>
            <Separator />
            <div className="p-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("cert.conditions")}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {certificate.conditions.map((condition, i) => (
                  <li key={i}>{condition}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="text-xs text-muted-foreground">
            <p>
              {t("cert.signedBy")}:{" "}
              <span className="font-medium text-foreground">
                {certificate.signedByName ?? t("cert.directorATM")}
              </span>
              , {t("cert.directorATM")}
            </p>
            <p className="mt-0.5">Issued {formatDateTime(certificate.issuedAt)}</p>
          </div>
          <Button variant="outline" onClick={() => window.print()} className="print:hidden">
            <Printer className="size-4" aria-hidden />
            {t("common.print")}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function InvalidResult({ code }: { code: string }) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="items-center gap-3 p-8 text-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={SPRING_SOFT}
          className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"
        >
          <ShieldX className="size-6" aria-hidden />
        </motion.span>
        <div>
          <p className="font-semibold text-destructive">{t("public.certInvalid")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            No certificate matches <span className="font-mono">{code}</span>. Check the HC number
            printed on the letter, or scan the QR code again. If the problem persists, contact
            CAAB Air Traffic Management Division.
          </p>
        </div>
      </Card>
    </motion.div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
