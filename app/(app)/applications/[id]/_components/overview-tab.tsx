"use client";

// Overview: applicant / authority / site cards + non-interactive mini OLS map.
import * as React from "react";
import { Building2, Landmark, MapPin, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OlsMap, OlsLegend } from "@/components/map/ols-map";
import { StatusBadge } from "@/components/shared/status-badge";
import { Stagger, StaggerItem } from "@/components/motion";
import { useT } from "@/components/providers";
import { formatCoords, formatMetres, formatDate } from "@/lib/format";
import { SlaChip } from "../../_components/sla-chip";
import type { DetailResponse } from "../../_components/types";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

export function OverviewTab({ detail }: { detail: DetailResponse }) {
  const t = useT();
  const { application: app, map } = detail;
  const latestEval = app.evaluationResults[0] ?? null;

  return (
    <Stagger className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <StaggerItem>
          <Card className="p-4">
            <div className="mb-1 flex items-center gap-2">
              <UserRound className="size-4 text-primary" aria-hidden />
              <h3 className="text-sm font-semibold">{t("application.applicant")}</h3>
            </div>
            <Row label="Organisation" value={app.applicantOrg.name} />
            <Row label="City" value={app.applicantOrg.city ?? "—"} />
            <Row label="Contact" value={app.applicantOrg.contact ?? "—"} />
            <Row label="Trade license" value={app.applicantOrg.tradeLicense ?? "—"} />
            <Separator className="my-2" />
            <Row
              label="Created by"
              value={
                <span>
                  {app.createdBy.name}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {app.createdBy.email}
                  </span>
                </span>
              }
            />
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="p-4">
            <div className="mb-1 flex items-center gap-2">
              <Landmark className="size-4 text-primary" aria-hidden />
              <h3 className="text-sm font-semibold">{t("application.authority")}</h3>
            </div>
            {app.authorityOrg ? (
              <>
                <Row label="Authority" value={app.authorityOrg.name} />
                <Row label="Code" value={app.authorityOrg.authorityCode ?? "—"} />
                <Row label="City" value={app.authorityOrg.city ?? "—"} />
              </>
            ) : (
              <p className="py-2 text-sm text-muted-foreground">
                Not yet routed through an approving authority.
              </p>
            )}
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="p-4">
            <div className="mb-1 flex items-center gap-2">
              <MapPin className="size-4 text-primary" aria-hidden />
              <h3 className="text-sm font-semibold">{t("application.site")}</h3>
            </div>
            <Row label={t("application.structureType")} value={app.structureType} />
            <Row label={t("application.siteAddress")} value={app.siteAddress ?? "—"} />
            <Row
              label={t("application.coordinates")}
              value={<span className="tabular-nums">{formatCoords(app.lat, app.lon)}</span>}
            />
            <Row
              label={t("application.groundElevation")}
              value={`${formatMetres(app.groundElevationM)} AMSL`}
            />
            <Row
              label={t("application.requestedHeight")}
              value={`${formatMetres(app.requestedHeightAglM)} AGL`}
            />
            <Row
              label={t("application.requestedTop")}
              value={`${formatMetres(app.requestedTopElevationAmslM)} AMSL`}
            />
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="p-4">
            <div className="mb-1 flex items-center gap-2">
              <Building2 className="size-4 text-primary" aria-hidden />
              <h3 className="text-sm font-semibold">Case</h3>
            </div>
            <Row label={t("common.status")} value={<StatusBadge status={app.status} />} />
            <Row label={t("application.slaDue")} value={<SlaChip due={app.slaDueAt} />} />
            <Row
              label={t("application.disciplines")}
              value={
                app.assignedDisciplines.length > 0 ? app.assignedDisciplines.join(", ") : "—"
              }
            />
            <Row label={t("application.assignedTo")} value={app.assignedOfficer?.name ?? "—"} />
            <Row label={t("application.submittedOn")} value={formatDate(app.submittedAt)} />
            {app.decidedAt && <Row label="Decided on" value={formatDate(app.decidedAt)} />}
          </Card>
        </StaggerItem>
      </div>

      <StaggerItem>
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <h3 className="text-sm font-semibold">
              {app.airport.icao} — {app.airport.name}
            </h3>
            {latestEval && <StatusBadge status={latestEval.status} />}
          </div>
          {map ? (
            <>
              <OlsMap
                center={[app.lon, app.lat]}
                zoom={11}
                surfaces={map.surfaces}
                runways={map.runways}
                site={{ lat: app.lat, lon: app.lon }}
                siteStatus={latestEval?.status ?? "NONE"}
                interactive={false}
                className="h-[420px] w-full"
              />
              <div className="border-t px-4 py-2">
                <OlsLegend />
              </div>
            </>
          ) : (
            <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
              Map unavailable for this aerodrome
            </div>
          )}
        </Card>
      </StaggerItem>
    </Stagger>
  );
}
