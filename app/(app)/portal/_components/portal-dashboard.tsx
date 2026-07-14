"use client";

// Applicant dashboard: KPI cards, "needs your attention" banner for
// RETURNED_FOR_INFO cases, and a DataTable of the org's applications.
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  FilePlus2,
  FolderOpen,
  Folders,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTransition, Stagger, FadeIn } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { useT } from "@/components/providers";
import { formatDate, slaState } from "@/lib/format";
import { ACTIVE_STATUSES } from "@/lib/workflow";
import { fetchJson, type PortalListItem, type PortalListResponse } from "./types";

function SlaCell({ item }: { item: PortalListItem }) {
  const active = ACTIVE_STATUSES.includes(item.status);
  const sla = slaState(active ? item.slaDueAt : null);
  if (sla.state === "none") return <span className="text-xs text-muted-foreground">—</span>;
  const tone =
    sla.state === "breach"
      ? "text-destructive"
      : sla.state === "warning"
        ? "text-warning"
        : "text-success";
  return <span className={`text-xs font-medium tabular-nums ${tone}`}>{sla.label}</span>;
}

export function PortalDashboard({
  userName,
  orgName,
}: {
  userName: string;
  orgName: string | null;
}) {
  const t = useT();
  const router = useRouter();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["portal-applications"],
    queryFn: () => fetchJson<PortalListResponse>("/api/applications?stats=1"),
  });

  React.useEffect(() => {
    if (isError) toast.error(error instanceof Error ? error.message : t("common.error"));
  }, [isError, error, t]);

  const items = React.useMemo(() => data?.items ?? [], [data]);
  const stats = data?.stats;
  const returned = React.useMemo(
    () => items.filter((i) => i.status === "RETURNED_FOR_INFO"),
    [items]
  );
  const certificates = React.useMemo(
    () => items.filter((i) => !!i.certificate).length,
    [items]
  );

  const columns = React.useMemo<ColumnDef<PortalListItem, unknown>[]>(
    () => [
      {
        id: "refNo",
        accessorFn: (r) => r.refNo,
        header: t("application.refNo"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-medium text-primary">{row.original.refNo}</span>
        ),
      },
      {
        id: "airport",
        accessorFn: (r) => r.airport.icao,
        header: t("common.airport"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            <span className="font-medium">{row.original.airport.icao}</span>{" "}
            <span className="hidden text-muted-foreground xl:inline">
              — {row.original.airport.name}
            </span>
          </span>
        ),
      },
      {
        id: "structure",
        accessorFn: (r) => r.structureType,
        header: t("application.structureType"),
        cell: ({ row }) => (
          <span className="block max-w-52 truncate" title={row.original.structureType}>
            {row.original.structureType}
            <span className="ml-1.5 tabular-nums text-xs text-muted-foreground">
              {row.original.requestedHeightAglM.toFixed(1)} m
            </span>
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (r) => r.status,
        header: t("common.status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "eval",
        accessorFn: (r) => r.latestEval?.status ?? "",
        header: t("application.evaluation"),
        cell: ({ row }) =>
          row.original.latestEval ? (
            <StatusBadge status={row.original.latestEval.status} />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "submitted",
        accessorFn: (r) => (r.submittedAt ? new Date(r.submittedAt).getTime() : 0),
        header: t("application.submittedOn"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.submittedAt)}
          </span>
        ),
      },
      {
        id: "sla",
        accessorFn: (r) => (r.slaDueAt ? new Date(r.slaDueAt).getTime() : Number.MAX_SAFE_INTEGER),
        header: "SLA",
        cell: ({ row }) => <SlaCell item={row.original} />,
      },
    ],
    [t]
  );

  return (
    <PageTransition>
      <PageHeader
        title={t("nav.myApplications")}
        description={
          orgName
            ? `${orgName} — height clearance applications and certificates.`
            : `Welcome back, ${userName}.`
        }
        crumbs={[{ label: t("nav.home"), href: "/portal" }, { label: t("nav.myApplications") }]}
        actions={
          <Button asChild>
            <Link href="/portal/new">
              <FilePlus2 className="size-4" aria-hidden />
              {t("nav.newApplication")}
            </Link>
          </Button>
        }
      />

      {/* Needs your attention */}
      {returned.length > 0 && (
        <FadeIn className="mb-6" y={8}>
          <div
            role="status"
            className="rounded-lg border border-warning/30 bg-warning/[0.06] px-4 py-3.5"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-warning">
              <RotateCcw className="size-4 shrink-0" aria-hidden />
              Needs your attention — {returned.length}{" "}
              {returned.length === 1 ? "application" : "applications"} returned for information
            </p>
            <ul className="mt-2 space-y-1.5">
              {returned.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/portal/applications/${item.id}`}
                    className="group flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-1 py-0.5 text-sm transition-colors hover:bg-warning/10 focus-visible:outline-2"
                  >
                    <span className="font-medium text-primary">{item.refNo}</span>
                    <span className="text-muted-foreground">
                      {item.structureType} · {item.airport.icao}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-warning">
                      Review and resubmit
                      <ArrowRight
                        className="size-3.5 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
      )}

      {/* KPI cards */}
      <Stagger className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("nav.myApplications")} value={items.length} icon={Folders} />
        <StatCard
          label="In progress"
          value={stats?.inProgress ?? 0}
          icon={FolderOpen}
          tone="info"
        />
        <StatCard
          label={t("nav.certificates")}
          value={certificates || (stats?.certificatesIssued ?? 0)}
          icon={BadgeCheck}
          tone="success"
        />
        <StatCard
          label="Needs action"
          value={returned.length}
          icon={AlertTriangle}
          tone={returned.length > 0 ? "warning" : "default"}
          hint={returned.length > 0 ? "Returned for information" : undefined}
        />
      </Stagger>

      <DataTable<PortalListItem>
        columns={columns}
        data={items}
        loading={isLoading}
        searchable
        searchPlaceholder={`${t("common.search")} — ref, airport, structure…`}
        pageSize={10}
        initialSorting={[{ id: "submitted", desc: true }]}
        onRowClick={(row) => router.push(`/portal/applications/${row.id}`)}
        emptyTitle="No applications yet"
        emptyDescription="Start your first height clearance application — it takes about five minutes."
        emptyAction={
          <Button asChild size="sm">
            <Link href="/portal/new">
              <FilePlus2 className="size-4" aria-hidden />
              {t("nav.newApplication")}
            </Link>
          </Button>
        }
        exportCsv={{
          filename: `my-applications-${new Date().toISOString().slice(0, 10)}.csv`,
          headers: ["Ref No", "Airport", "Structure", "Height (m AGL)", "Status", "Evaluation", "Submitted"],
          row: (r) => [
            r.refNo,
            r.airport.icao,
            r.structureType,
            r.requestedHeightAglM,
            r.status,
            r.latestEval?.status ?? "",
            r.submittedAt ? formatDate(r.submittedAt) : "",
          ],
        }}
      />
    </PageTransition>
  );
}
