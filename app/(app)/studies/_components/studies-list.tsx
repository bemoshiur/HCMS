"use client";

// Aeronautical study queue — open + completed buckets with KPIs.
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, FolderCheck, Percent, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageTransition, Stagger } from "@/components/motion";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/components/providers";
import { formatDate, formatMetres, slaState } from "@/lib/format";
import { fetchJson } from "@/app/(app)/applications/_components/api";
import { cn } from "@/lib/utils";
import type { StudyListItem, StudyQueueResponse } from "./types";

export function StudiesList() {
  const t = useT();
  const router = useRouter();
  const { data, isLoading } = useQuery<StudyQueueResponse>({
    queryKey: ["studies"],
    queryFn: () => fetchJson<StudyQueueResponse>("/api/studies"),
  });

  const columns = React.useMemo<ColumnDef<StudyListItem, unknown>[]>(
    () => [
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.type === "AERONAUTICAL" ? "Aeronautical" : "Shielding"}</Badge>
        ),
      },
      {
        id: "refNo",
        accessorFn: (r) => r.application.refNo,
        header: t("application.refNo"),
        cell: ({ row }) => <span className="font-medium">{row.original.application.refNo}</span>,
      },
      {
        id: "applicant",
        accessorFn: (r) => r.application.applicantOrg.name,
        header: t("application.applicant"),
      },
      {
        id: "airport",
        accessorFn: (r) => r.application.airport.icao,
        header: t("common.airport"),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.application.airport.icao}</span>,
      },
      {
        id: "penetration",
        accessorFn: (r) => r.latestEval?.penetrationM ?? 0,
        header: t("public.penetration"),
        cell: ({ row }) => {
          const p = row.original.latestEval?.penetrationM ?? null;
          return p != null && p > 0 ? (
            <span className="font-medium text-destructive tabular-nums">{formatMetres(p)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        id: "officer",
        accessorFn: (r) => r.officer?.name ?? "",
        header: "Officer",
        cell: ({ row }) => row.original.officer?.name ?? <span className="text-muted-foreground">Unassigned</span>,
      },
      {
        id: "outcome",
        header: t("common.status"),
        cell: ({ row }) =>
          row.original.outcome ? (
            <StatusBadge status={row.original.outcome === "PERMIT_WITH_CONDITIONS" ? "APPROVED" : "REJECTED"} showDot={false} />
          ) : (
            <span className="text-xs text-warning">Open</span>
          ),
      },
      {
        id: "created",
        accessorFn: (r) => r.createdAt,
        header: t("common.date"),
        cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
      },
    ],
    [t]
  );

  const exportCsv = {
    filename: "studies.csv",
    headers: ["Type", "Ref", "Applicant", "Airport", "Penetration (m)", "Officer", "Outcome", "Created"],
    row: (s: StudyListItem) => [
      s.type,
      s.application.refNo,
      s.application.applicantOrg.name,
      s.application.airport.icao,
      s.latestEval?.penetrationM ?? "",
      s.officer?.name ?? "",
      s.outcome ?? "OPEN",
      formatDate(s.createdAt),
    ],
  };

  return (
    <PageTransition>
      <PageHeader
        title={t("nav.studies")}
        description="Aeronautical and shielding studies for penetrating proposals. Complete a study to advance the case to a final decision."
        crumbs={[{ label: t("nav.dashboard"), href: "/dashboard" }, { label: t("nav.studies") }]}
      />

      {isLoading ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <Stagger className="mb-6 grid gap-4 sm:grid-cols-3" stagger={0.05}>
          <StatCard label="Open studies" value={data?.stats.open ?? 0} icon={FlaskConical} tone="warning" />
          <StatCard label="Completed" value={data?.stats.completed ?? 0} icon={FolderCheck} tone="success" />
          <StatCard label="Permit-with-conditions rate" value={data?.stats.permitRate ?? 0} suffix="%" icon={Percent} tone="info" />
        </Stagger>
      )}

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open ({data?.open.length ?? 0})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({data?.completed.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="mt-4">
          <DataTable
            columns={columns}
            data={data?.open ?? []}
            loading={isLoading}
            exportCsv={exportCsv}
            onRowClick={(s) => router.push(`/studies/${s.id}`)}
            emptyTitle="No open studies"
            emptyDescription="Cases referred by discipline reviewers appear here for aeronautical assessment."
            initialSorting={[{ id: "created", desc: true }]}
          />
        </TabsContent>
        <TabsContent value="completed" className="mt-4">
          <DataTable
            columns={columns}
            data={data?.completed ?? []}
            loading={isLoading}
            exportCsv={exportCsv}
            onRowClick={(s) => router.push(`/studies/${s.id}`)}
            emptyTitle="No completed studies"
            initialSorting={[{ id: "created", desc: true }]}
          />
        </TabsContent>
      </Tabs>
    </PageTransition>
  );
}
