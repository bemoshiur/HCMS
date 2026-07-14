"use client";

// Certificate summary — issuance/lifecycle lives in the certificates module.
import * as React from "react";
import Link from "next/link";
import { Award, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Stagger, StaggerItem } from "@/components/motion";
import { useT } from "@/components/providers";
import { formatDate, formatMetres } from "@/lib/format";
import type { DetailResponse } from "../../_components/types";

export function CertificateTab({ detail }: { detail: DetailResponse }) {
  const t = useT();
  const { application: app, viewer } = detail;
  const certificates = app.certificates;

  if (certificates.length === 0) {
    return (
      <EmptyState
        icon={Award}
        title="No certificate issued"
        description={
          app.status === "APPROVED"
            ? "The case is approved. The height clearance certificate is issued from the Certificates module."
            : "A certificate is issued after the case is approved by the Director (ATM)."
        }
        action={
          app.status === "APPROVED" && viewer.isCaab ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/certificates">
                {t("nav.certificates")}
                <ExternalLink className="size-3.5" aria-hidden />
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <Stagger className="space-y-3">
      {certificates.map((cert) => (
        <StaggerItem key={cert.id}>
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Award className="size-4 text-primary" aria-hidden />
                <h3 className="text-sm font-semibold tabular-nums">{cert.hcNo}</h3>
                <StatusBadge status={cert.status} />
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/certificates">
                  {t("common.view")} · {t("nav.certificates")}
                  <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              </Button>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Decision</dt>
                <dd className="font-medium">
                  {cert.decision === "GRANTED" ? t("cert.granted") : t("cert.objection")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("public.permissibleTopElevation")}
                </dt>
                <dd className="font-medium tabular-nums">{formatMetres(cert.ptE_amslM)} AMSL</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("public.permissibleHeight")}</dt>
                <dd className="font-medium tabular-nums">{formatMetres(cert.permissibleAglM)} AGL</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("public.governingSurface")}</dt>
                <dd className="font-medium">{cert.governingSurface ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("cert.validity")}</dt>
                <dd className="font-medium whitespace-nowrap">
                  {formatDate(cert.validFrom)} – {formatDate(cert.validTo)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Issued</dt>
                <dd className="font-medium">{formatDate(cert.issuedAt)}</dd>
              </div>
            </dl>
            {cert.conditions.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {t("cert.conditions")}
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-sm">
                  {cert.conditions.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
