"use client";

/**
 * Obstacle monitoring board — groups flagged structures (Illegal → Penetrating
 * → Under monitoring) into cards with re-check, set-status and add-note actions,
 * plus complaint logging. Alerts when any structure is flagged illegal.
 */
import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Megaphone,
  NotebookPen,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  Radar,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageTransition, Stagger, StaggerItem, FadeIn } from "@/components/motion";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/components/providers";
import { formatCoords, formatMetres, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  checkSummary,
  fetchJson,
  OBSTACLE_STATUSES,
  type AirportOption,
  type CheckResponse,
  type ObstacleRow,
  type ObstaclesPayload,
  type ObstacleStatus,
} from "../../_components/types";
import { NoteDialog } from "./note-dialog";
import { LogComplaintDialog } from "./log-complaint-dialog";

const FLAGGED: ObstacleStatus[] = ["ILLEGAL", "PENETRATING", "UNDER_MONITORING"];

const SECTIONS: { status: ObstacleStatus; title: string; icon: typeof ShieldAlert; tone: string }[] = [
  { status: "ILLEGAL", title: "Illegal", icon: ShieldAlert, tone: "text-destructive" },
  { status: "PENETRATING", title: "Penetrating", icon: TriangleAlert, tone: "text-destructive" },
  { status: "UNDER_MONITORING", title: "Under monitoring", icon: Radar, tone: "text-warning" },
];

export function MonitoringBoard() {
  const t = useT();
  const queryClient = useQueryClient();
  const [noteFor, setNoteFor] = React.useState<ObstacleRow | null>(null);
  const [complaintOpen, setComplaintOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery<ObstaclesPayload>({
    queryKey: ["obstacles"],
    queryFn: () => fetchJson<ObstaclesPayload>("/api/obstacles"),
  });
  const { data: airports } = useQuery<AirportOption[]>({
    queryKey: ["airports"],
    queryFn: () => fetchJson<AirportOption[]>("/api/airports"),
    staleTime: 5 * 60_000,
  });

  const canManage = data?.canManage ?? false;
  const flagged = (data?.items ?? []).filter((o) => FLAGGED.includes(o.status));
  const illegalCount = flagged.filter((o) => o.status === "ILLEGAL").length;

  const recheck = useMutation({
    mutationFn: (id: string) =>
      fetchJson<CheckResponse>(`/api/obstacles/${id}/check`, { method: "POST" }),
    onMutate: (id) => setBusyId(id),
    onSuccess: (res) => {
      toast.success("Compliance re-checked", { description: checkSummary(res) });
      queryClient.invalidateQueries({ queryKey: ["obstacles"] });
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
    onSettled: () => setBusyId(null),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ObstacleStatus }) =>
      fetchJson<{ obstacle: ObstacleRow }>(`/api/obstacles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["obstacles"] });
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  return (
    <PageTransition>
      <PageHeader
        title={t("nav.monitoring")}
        description="Track flagged structures near the aerodromes — penetrating, under monitoring, and illegal obstacles requiring action."
        crumbs={[
          { label: t("nav.obstacles"), href: "/obstacles" },
          { label: t("nav.monitoring") },
        ]}
        actions={
          canManage ? (
            <Button onClick={() => setComplaintOpen(true)}>
              <Megaphone className="size-4" aria-hidden /> Log complaint
            </Button>
          ) : null
        }
      />

      {/* Illegal alert */}
      {illegalCount > 0 && (
        <FadeIn className="mb-5">
          <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
            <ShieldAlert className="size-5 shrink-0 text-destructive" aria-hidden />
            <p className="text-sm">
              <span className="font-semibold text-destructive">
                {illegalCount} structure{illegalCount === 1 ? "" : "s"} flagged illegal
              </span>{" "}
              — enforcement action pending. Notify the aerodrome operator and the relevant authority.
            </p>
          </div>
        </FadeIn>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 w-full" />)}
        </div>
      ) : flagged.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No flagged structures"
          description="Every registered obstacle is compliant. Penetrating, monitored and illegal structures will appear here."
        />
      ) : (
        <div className="space-y-8">
          {SECTIONS.map((section) => {
            const items = flagged.filter((o) => o.status === section.status);
            if (items.length === 0) return null;
            return (
              <section key={section.status}>
                <div className="mb-3 flex items-center gap-2">
                  <section.icon className={cn("size-5", section.tone)} aria-hidden />
                  <h2 className="text-base font-semibold">{section.title}</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                    {items.length}
                  </span>
                </div>
                <Stagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" stagger={0.04}>
                  {items.map((o) => (
                    <StaggerItem key={o.id}>
                      <Card
                        className={cn(
                          "flex h-full flex-col gap-3 p-4",
                          section.status === "ILLEGAL" && "border-destructive/30"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{o.name ?? o.structureType}</p>
                            <p className="text-xs text-muted-foreground">
                              {o.airport.icao} · {o.structureType}
                            </p>
                          </div>
                          <StatusBadge status={o.status} showDot={false} className="shrink-0" />
                        </div>

                        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                          <dt className="text-muted-foreground">Top elevation</dt>
                          <dd className="text-right font-medium tabular-nums">{formatMetres(o.topElevationAmslM)} AMSL</dd>
                          <dt className="text-muted-foreground">Height</dt>
                          <dd className="text-right tabular-nums">{o.heightAglM != null ? formatMetres(o.heightAglM) : "—"} AGL</dd>
                          <dt className="text-muted-foreground">Coordinates</dt>
                          <dd className="truncate text-right font-mono">{formatCoords(o.lat, o.lon)}</dd>
                          <dt className="text-muted-foreground">Last checked</dt>
                          <dd className="text-right">{o.lastCheckedAt ? timeAgo(o.lastCheckedAt) : "Never"}</dd>
                        </dl>

                        {o.remarks && (
                          <p className="line-clamp-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground" title={o.remarks}>
                            {o.remarks.split("\n").slice(-1)[0]}
                          </p>
                        )}

                        {o.linkedApplication && (
                          <Link
                            href={`/applications/${o.linkedApplication.id}`}
                            className="text-xs font-medium text-info hover:underline"
                          >
                            {o.linkedApplication.refNo}
                          </Link>
                        )}

                        {canManage && (
                          <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => recheck.mutate(o.id)}
                              disabled={busyId === o.id}
                            >
                              {busyId === o.id ? (
                                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                              ) : (
                                <RefreshCw className="size-3.5" aria-hidden />
                              )}
                              Re-check
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setNoteFor(o)}>
                              <NotebookPen className="size-3.5" aria-hidden /> Note
                            </Button>
                            <Select
                              value={o.status}
                              onValueChange={(v) => setStatus.mutate({ id: o.id, status: v as ObstacleStatus })}
                            >
                              <SelectTrigger size="sm" className="ml-auto h-7 w-[128px]" aria-label="Set status">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {OBSTACLE_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </Card>
                    </StaggerItem>
                  ))}
                </Stagger>
              </section>
            );
          })}
        </div>
      )}

      <NoteDialog obstacle={noteFor} onOpenChange={(open) => !open && setNoteFor(null)} />
      <LogComplaintDialog open={complaintOpen} onOpenChange={setComplaintOpen} airports={(airports ?? []).map((a) => ({ id: a.id, icao: a.icao, name: a.name, referenceLat: a.referenceLat, referenceLon: a.referenceLon }))} />
    </PageTransition>
  );
}
