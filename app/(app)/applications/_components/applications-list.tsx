"use client";

// Case list: KPI row, rich filters, DataTable with bulk assign/export (§17).
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import {
  AlertTriangle,
  BadgeCheck,
  Download,
  FolderOpen,
  OctagonX,
  UserCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageTransition, Stagger } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { useT } from "@/components/providers";
import { formatDate, toCsv, downloadBlob } from "@/lib/format";
import { ACTIVE_STATUSES } from "@/lib/workflow";
import { fetchJson, buildListQuery } from "./api";
import { SlaChip } from "./sla-chip";
import type { AirportOption, ApplicationListItem, ListResponse } from "./types";

const ALL = "__all__";

const STATUS_OPTIONS = [
  "SUBMITTED",
  "ENDORSED",
  "INTAKE_SCRUTINY",
  "UNDER_REVIEW",
  "STUDY",
  "DECISION_PENDING",
  "APPROVED",
  "REJECTED",
  "RETURNED_FOR_INFO",
  "CERTIFICATE_ISSUED",
  "REVALIDATION",
  "EXPIRED",
  "REVOKED",
] as const;

const ASSIGNABLE_STATUSES = ["ENDORSED", "INTAKE_SCRUTINY", "UNDER_REVIEW", "STUDY"];

interface SessionUserProp {
  id: string;
  role: Role;
  name: string;
}

interface Filters {
  icao: string;
  status: string;
  structureType: string;
  authorityOrgId: string;
  from: string;
  to: string;
  slaBreached: boolean;
}

const EMPTY_FILTERS: Filters = {
  icao: ALL,
  status: ALL,
  structureType: ALL,
  authorityOrgId: ALL,
  from: "",
  to: "",
  slaBreached: false,
};

export function ApplicationsList({ sessionUser }: { sessionUser: SessionUserProp }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);

  const queryString = React.useMemo(
    () =>
      buildListQuery({
        stats: "1",
        icao: filters.icao === ALL ? undefined : filters.icao,
        status: filters.status === ALL ? undefined : filters.status,
        structureType: filters.structureType === ALL ? undefined : filters.structureType,
        authorityOrgId: filters.authorityOrgId === ALL ? undefined : filters.authorityOrgId,
        from: filters.from || undefined,
        to: filters.to || undefined,
        slaBreached: filters.slaBreached ? "1" : undefined,
      }),
    [filters]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["applications", queryString],
    queryFn: () => fetchJson<ListResponse>(`/api/applications${queryString}`),
  });

  React.useEffect(() => {
    if (isError) toast.error(error instanceof Error ? error.message : t("common.error"));
  }, [isError, error, t]);

  const { data: airports } = useQuery({
    queryKey: ["airports"],
    queryFn: () => fetchJson<AirportOption[]>("/api/airports"),
    staleTime: 5 * 60_000,
  });

  const items = React.useMemo(() => data?.items ?? [], [data]);
  const stats = data?.stats;
  const canBulkAssign = sessionUser.role === "INTAKE_OFFICER" || sessionUser.role === "ADMIN";

  // Facets derived from the loaded rows (plus current selection so it never vanishes)
  const structureTypes = React.useMemo(() => {
    const set = new Set(items.map((i) => i.structureType));
    if (filters.structureType !== ALL) set.add(filters.structureType);
    return [...set].sort();
  }, [items, filters.structureType]);

  const authorities = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items) if (i.authorityOrg) map.set(i.authorityOrg.id, i.authorityOrg.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const assignToMe = useMutation({
    mutationFn: async (rows: ApplicationListItem[]) => {
      const eligible = rows.filter((r) => ASSIGNABLE_STATUSES.includes(r.status));
      let done = 0;
      for (const row of eligible) {
        await fetchJson(`/api/applications/${row.id}/assign`, {
          method: "POST",
          body: JSON.stringify({ officerId: sessionUser.id }),
        });
        done++;
      }
      return { done, skipped: rows.length - eligible.length };
    },
    onSuccess: ({ done, skipped }) => {
      toast.success(
        `${done} case${done === 1 ? "" : "s"} assigned to you${skipped ? ` (${skipped} skipped — not assignable)` : ""}`
      );
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  const exportSelection = React.useCallback((rows: ApplicationListItem[]) => {
    const csv = toCsv(
      ["Ref No", "Applicant", "Airport", "Structure", "Height (m AGL)", "Evaluation", "Status", "SLA due", "Submitted"],
      rows.map((r) => [
        r.refNo,
        r.applicantOrg.name,
        r.airport.icao,
        r.structureType,
        r.requestedHeightAglM,
        r.latestEval?.status ?? "",
        r.status,
        r.slaDueAt ? formatDate(r.slaDueAt) : "",
        r.submittedAt ? formatDate(r.submittedAt) : "",
      ])
    );
    downloadBlob(csv, `applications-selection-${new Date().toISOString().slice(0, 10)}.csv`);
  }, []);

  const columns = React.useMemo<ColumnDef<ApplicationListItem, unknown>[]>(
    () => [
      {
        id: "refNo",
        accessorFn: (r) => r.refNo,
        header: t("application.refNo"),
        cell: ({ row }) => (
          <span className="font-medium text-primary whitespace-nowrap">{row.original.refNo}</span>
        ),
      },
      {
        id: "applicant",
        accessorFn: (r) => r.applicantOrg.name,
        header: t("application.applicant"),
        cell: ({ row }) => (
          <span className="block max-w-48 truncate" title={row.original.applicantOrg.name}>
            {row.original.applicantOrg.name}
          </span>
        ),
      },
      {
        id: "airport",
        accessorFn: (r) => r.airport.icao,
        header: t("common.airport"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            <span className="font-medium">{row.original.airport.icao}</span>{" "}
            <span className="text-muted-foreground hidden xl:inline">
              — {row.original.airport.name}
            </span>
          </span>
        ),
      },
      {
        id: "structureType",
        accessorFn: (r) => r.structureType,
        header: t("application.structureType"),
      },
      {
        id: "height",
        accessorFn: (r) => r.requestedHeightAglM,
        header: () => <span className="whitespace-nowrap">{t("application.requestedHeight")}</span>,
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.requestedHeightAglM.toFixed(1)} m</span>
        ),
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
        id: "status",
        accessorFn: (r) => r.status,
        header: t("common.status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "sla",
        accessorFn: (r) => (r.slaDueAt ? new Date(r.slaDueAt).getTime() : Number.MAX_SAFE_INTEGER),
        header: "SLA",
        cell: ({ row }) => (
          <SlaChip
            due={ACTIVE_STATUSES.includes(row.original.status) ? row.original.slaDueAt : null}
          />
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
    ],
    [t]
  );

  const hasActiveFilters =
    filters.icao !== ALL ||
    filters.status !== ALL ||
    filters.structureType !== ALL ||
    filters.authorityOrgId !== ALL ||
    !!filters.from ||
    !!filters.to ||
    filters.slaBreached;

  return (
    <PageTransition>
      <PageHeader
        title={t("nav.applications")}
        description="Height clearance cases across the workflow — scrutiny, review, study and decision."
        crumbs={[{ label: t("nav.dashboard"), href: "/dashboard" }, { label: t("nav.applications") }]}
        actions={
          <Button
            variant="outline"
            onClick={() => window.open(`/api/applications/export${queryString}`, "_blank")}
          >
            <Download className="size-4" aria-hidden />
            {t("common.exportCsv")}
          </Button>
        }
      />

      {/* KPI row */}
      <Stagger className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="In progress"
          value={stats?.inProgress ?? 0}
          icon={FolderOpen}
          tone="info"
        />
        <StatCard
          label="SLA breached"
          value={stats?.slaBreached ?? 0}
          icon={AlertTriangle}
          tone="danger"
        />
        <StatCard label="Objections" value={stats?.objections ?? 0} icon={OctagonX} tone="warning" />
        <StatCard
          label="Certificates issued"
          value={stats?.certificatesIssued ?? 0}
          icon={BadgeCheck}
          tone="success"
        />
      </Stagger>

      <DataTable<ApplicationListItem>
        columns={columns}
        data={items}
        loading={isLoading}
        searchable
        searchPlaceholder={`${t("common.search")} — ref, applicant, structure…`}
        pageSize={20}
        initialSorting={[{ id: "submitted", desc: true }]}
        onRowClick={(row) => router.push(`/applications/${row.id}`)}
        emptyTitle={hasActiveFilters ? t("common.noResults") : "No applications yet"}
        emptyDescription={
          hasActiveFilters
            ? "Try adjusting or clearing the filters."
            : "Cases will appear here once applications are submitted and endorsed."
        }
        emptyAction={
          hasActiveFilters ? (
            <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
              <X className="size-4" aria-hidden />
              {t("common.clearFilters")}
            </Button>
          ) : undefined
        }
        exportCsv={{
          filename: `applications-${new Date().toISOString().slice(0, 10)}.csv`,
          headers: [
            "Ref No",
            "Applicant",
            "Airport",
            "Structure",
            "Height (m AGL)",
            "Evaluation",
            "Status",
            "SLA due",
            "Submitted",
          ],
          row: (r) => [
            r.refNo,
            r.applicantOrg.name,
            r.airport.icao,
            r.structureType,
            r.requestedHeightAglM,
            r.latestEval?.status ?? "",
            r.status,
            r.slaDueAt ? formatDate(r.slaDueAt) : "",
            r.submittedAt ? formatDate(r.submittedAt) : "",
          ],
        }}
        bulkActions={(rows, clear) => (
          <>
            {canBulkAssign && (
              <Button
                size="xs"
                variant="secondary"
                disabled={assignToMe.isPending}
                onClick={() =>
                  assignToMe.mutate(rows, {
                    onSuccess: () => clear(),
                  })
                }
              >
                <UserCheck className="size-3.5" aria-hidden />
                {assignToMe.isPending ? "Assigning…" : "Assign to me"}
              </Button>
            )}
            <Button
              size="xs"
              variant="secondary"
              onClick={() => {
                exportSelection(rows);
                clear();
              }}
            >
              <Download className="size-3.5" aria-hidden />
              {t("common.export")}
            </Button>
          </>
        )}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={filters.icao}
              onValueChange={(v) => setFilters((f) => ({ ...f, icao: v }))}
            >
              <SelectTrigger size="sm" aria-label={t("common.airport")} className="w-[120px]">
                <SelectValue placeholder={t("common.airport")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("common.all")} — {t("common.airport").toLowerCase()}</SelectItem>
                {(airports ?? []).map((a) => (
                  <SelectItem key={a.icao} value={a.icao}>
                    {a.icao} · {a.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            >
              <SelectTrigger size="sm" aria-label={t("common.status")} className="w-[150px]">
                <SelectValue placeholder={t("common.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("common.all")} — {t("common.status").toLowerCase()}</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.structureType}
              onValueChange={(v) => setFilters((f) => ({ ...f, structureType: v }))}
            >
              <SelectTrigger size="sm" aria-label={t("application.structureType")} className="w-[150px]">
                <SelectValue placeholder={t("application.structureType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("common.all")} — structures</SelectItem>
                {structureTypes.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.authorityOrgId}
              onValueChange={(v) => setFilters((f) => ({ ...f, authorityOrgId: v }))}
            >
              <SelectTrigger size="sm" aria-label={t("application.authority")} className="w-[160px]">
                <SelectValue placeholder={t("application.authority")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("common.all")} — authorities</SelectItem>
                {authorities.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                className="h-8 w-[140px]"
                aria-label={`${t("application.submittedOn")} ${t("common.from")}`}
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                className="h-8 w-[140px]"
                aria-label={`${t("application.submittedOn")} ${t("common.to")}`}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Switch
                id="sla-breach-filter"
                checked={filters.slaBreached}
                onCheckedChange={(v) => setFilters((f) => ({ ...f, slaBreached: v }))}
                aria-label="Show only SLA breached"
              />
              <Label htmlFor="sla-breach-filter" className="text-xs text-muted-foreground">
                SLA breached
              </Label>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-muted-foreground"
              >
                <X className="size-3.5" aria-hidden />
                {t("common.clearFilters")}
              </Button>
            )}
          </div>
        }
      />
    </PageTransition>
  );
}
