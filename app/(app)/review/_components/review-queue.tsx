"use client";

// Per-discipline review queue: KPI row, pending DataTable and a recently
// decided tab. Row click opens the review console.
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Discipline } from "@prisma/client";
import { CheckCircle2, ClipboardCheck, FlaskConical, Inbox } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageTransition, Stagger } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { useT } from "@/components/providers";
import { formatDate, formatDateTime, formatMetres } from "@/lib/format";
import { fetchJson } from "@/app/(app)/applications/_components/api";
import { SlaChip } from "@/app/(app)/applications/_components/sla-chip";
import { DISCIPLINE_LABELS, type ReviewListItem, type ReviewQueueResponse } from "./types";

function waitingDays(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000));
}

export function ReviewQueue({ discipline }: { discipline: Discipline }) {
  const t = useT();
  const router = useRouter();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["reviews"],
    queryFn: () => fetchJson<ReviewQueueResponse>("/api/reviews"),
  });

  React.useEffect(() => {
    if (isError) toast.error(error instanceof Error ? error.message : t("common.error"));
  }, [isError, error, t]);

  const pending = React.useMemo(() => data?.pending ?? [], [data]);
  const decided = React.useMemo(() => data?.decided ?? [], [data]);
  const stats = data?.stats;

  const baseColumns = React.useMemo<ColumnDef<ReviewListItem, unknown>[]>(
    () => [
      {
        id: "refNo",
        accessorFn: (r) => r.application.refNo,
        header: t("application.refNo"),
        cell: ({ row }) => (
          <span className="font-medium text-primary whitespace-nowrap">
            {row.original.application.refNo}
          </span>
        ),
      },
      {
        id: "applicant",
        accessorFn: (r) => r.application.applicantOrg.name,
        header: t("application.applicant"),
        cell: ({ row }) => (
          <span className="block max-w-44 truncate" title={row.original.application.applicantOrg.name}>
            {row.original.application.applicantOrg.name}
          </span>
        ),
      },
      {
        id: "airport",
        accessorFn: (r) => r.application.airport.icao,
        header: t("common.airport"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            <span className="font-medium">{row.original.application.airport.icao}</span>{" "}
            <span className="text-muted-foreground hidden xl:inline">
              — {row.original.application.airport.name}
            </span>
          </span>
        ),
      },
      {
        id: "structureType",
        accessorFn: (r) => r.application.structureType,
        header: t("application.structureType"),
      },
      {
        id: "height",
        accessorFn: (r) => r.application.requestedHeightAglM,
        header: () => <span className="whitespace-nowrap">{t("application.requestedHeight")}</span>,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.application.requestedHeightAglM.toFixed(1)} m
          </span>
        ),
      },
    ],
    [t]
  );

  const pendingColumns = React.useMemo<ColumnDef<ReviewListItem, unknown>[]>(
    () => [
      ...baseColumns,
      {
        id: "assessment",
        accessorFn: (r) => r.latestEval?.status ?? "",
        header: "Auto assessment",
        cell: ({ row }) =>
          row.original.latestEval ? (
            <StatusBadge status={row.original.latestEval.status} />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "sla",
        accessorFn: (r) =>
          r.application.slaDueAt ? new Date(r.application.slaDueAt).getTime() : Number.MAX_SAFE_INTEGER,
        header: "SLA",
        cell: ({ row }) => <SlaChip due={row.original.application.slaDueAt} />,
      },
      {
        id: "waiting",
        accessorFn: (r) => waitingDays(r.createdAt),
        header: "Waiting",
        cell: ({ row }) => {
          const days = waitingDays(row.original.createdAt);
          return (
            <span className="tabular-nums text-muted-foreground whitespace-nowrap">
              {days}d
            </span>
          );
        },
      },
    ],
    [baseColumns]
  );

  const decidedColumns = React.useMemo<ColumnDef<ReviewListItem, unknown>[]>(
    () => [
      ...baseColumns,
      {
        id: "verdict",
        accessorFn: (r) => r.verdict ?? "",
        header: "Verdict",
        cell: ({ row }) =>
          row.original.verdict ? <StatusBadge status={row.original.verdict} /> : null,
      },
      {
        id: "override",
        accessorFn: (r) => r.overrideValueAmslM ?? "",
        header: () => <span className="whitespace-nowrap">Override (m AMSL)</span>,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.overrideValueAmslM != null
              ? formatMetres(row.original.overrideValueAmslM)
              : "—"}
          </span>
        ),
      },
      {
        id: "decidedAt",
        accessorFn: (r) => (r.decidedAt ? new Date(r.decidedAt).getTime() : 0),
        header: "Decided",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDateTime(row.original.decidedAt)}
          </span>
        ),
      },
    ],
    [baseColumns]
  );

  return (
    <PageTransition>
      <PageHeader
        title={`${t("nav.review")} — ${discipline}`}
        description={`${DISCIPLINE_LABELS[discipline] ?? discipline}. Confirm the automatic assessment, override it with reasons, or refer the case to an aeronautical study.`}
        crumbs={[{ label: t("nav.dashboard"), href: "/dashboard" }, { label: t("nav.review") }]}
      />

      <Stagger className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Pending reviews" value={stats?.pending ?? 0} icon={Inbox} tone="warning" />
        <StatCard
          label="Decided this month"
          value={stats?.decidedThisMonth ?? 0}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Referred to study"
          value={stats?.referredToStudy ?? 0}
          icon={FlaskConical}
          tone="info"
          hint="All time, this discipline"
        />
      </Stagger>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="mb-4 h-9">
          <TabsTrigger value="pending">
            Pending
            {pending.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="decided">Recently decided</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <DataTable<ReviewListItem>
            columns={pendingColumns}
            data={pending}
            loading={isLoading}
            searchable
            searchPlaceholder={`${t("common.search")} — ref, applicant, structure…`}
            pageSize={10}
            initialSorting={[{ id: "waiting", desc: true }]}
            onRowClick={(row) => router.push(`/review/${row.id}`)}
            emptyTitle="Queue clear"
            emptyDescription={`No ${discipline} reviews are waiting. New cases appear here when intake assigns your discipline.`}
            exportCsv={{
              filename: `review-queue-${discipline.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
              headers: [
                "Ref No",
                "Applicant",
                "Airport",
                "Structure",
                "Height (m AGL)",
                "Auto assessment",
                "SLA due",
                "Waiting (days)",
              ],
              row: (r) => [
                r.application.refNo,
                r.application.applicantOrg.name,
                r.application.airport.icao,
                r.application.structureType,
                r.application.requestedHeightAglM,
                r.latestEval?.status ?? "",
                r.application.slaDueAt ? formatDate(r.application.slaDueAt) : "",
                waitingDays(r.createdAt),
              ],
            }}
          />
        </TabsContent>

        <TabsContent value="decided">
          <DataTable<ReviewListItem>
            columns={decidedColumns}
            data={decided}
            loading={isLoading}
            searchable
            searchPlaceholder={`${t("common.search")} — ref, applicant…`}
            pageSize={10}
            initialSorting={[{ id: "decidedAt", desc: true }]}
            onRowClick={(row) => router.push(`/review/${row.id}`)}
            emptyTitle="No decisions yet"
            emptyDescription="Your 20 most recent verdicts will appear here."
            exportCsv={{
              filename: `review-decided-${discipline.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
              headers: [
                "Ref No",
                "Applicant",
                "Airport",
                "Structure",
                "Height (m AGL)",
                "Verdict",
                "Override (m AMSL)",
                "Decided",
              ],
              row: (r) => [
                r.application.refNo,
                r.application.applicantOrg.name,
                r.application.airport.icao,
                r.application.structureType,
                r.application.requestedHeightAglM,
                r.verdict ?? "",
                r.overrideValueAmslM ?? "",
                r.decidedAt ? formatDateTime(r.decidedAt) : "",
              ],
            }}
          />
        </TabsContent>
      </Tabs>

      {!isLoading && !isError && pending.length === 0 && decided.length === 0 && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ClipboardCheck className="size-3.5" aria-hidden />
          Reviews are created when the intake officer accepts a case and assigns the {discipline}{" "}
          discipline.
        </p>
      )}
    </PageTransition>
  );
}
