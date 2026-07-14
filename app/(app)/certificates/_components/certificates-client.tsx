"use client";

// Certificate register: KPI cards, approved-awaiting-issuance queue,
// filterable/exportable data table, PDF view + lifecycle actions.
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Ban,
  CalendarClock,
  CalendarX,
  Copy,
  FileCheck2,
  FileClock,
  FileText,
  MoreHorizontal,
  RefreshCw,
  RotateCw,
  ScrollText,
} from "lucide-react";
import { PageTransition, Stagger, StaggerItem, SkeletonSwap, FadeIn } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatMetres } from "@/lib/format";
import { useT } from "@/components/providers";
import { cn } from "@/lib/utils";
import { IssueDialog } from "./issue-dialog";
import { LifecycleDialog } from "./lifecycle-dialog";
import {
  fetchJson,
  type AirportOption,
  type AwaitingRow,
  type CertificateRow,
  type CertificatesPayload,
  type LifecycleAction,
} from "./types";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function CertificatesClient() {
  const t = useT();
  const router = useRouter();

  const [airportFilter, setAirportFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [issueRow, setIssueRow] = React.useState<AwaitingRow | null>(null);
  const [lifecycle, setLifecycle] = React.useState<{
    cert: CertificateRow;
    action: LifecycleAction;
  } | null>(null);

  const query = React.useMemo(() => {
    const params = new URLSearchParams();
    if (airportFilter !== "all") params.set("airport", airportFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [airportFilter, statusFilter]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["certificates", airportFilter, statusFilter],
    queryFn: () => fetchJson<CertificatesPayload>(`/api/certificates${query}`),
  });

  const { data: airports } = useQuery({
    queryKey: ["airports"],
    queryFn: () => fetchJson<AirportOption[]>("/api/airports"),
    staleTime: 5 * 60 * 1000,
  });

  const canManage = data?.canManage ?? false;

  const viewPdf = React.useCallback((cert: CertificateRow) => {
    window.open(`/api/certificates/${cert.id}/pdf`, "_blank", "noopener");
  }, []);

  const columns = React.useMemo<ColumnDef<CertificateRow, unknown>[]>(
    () => [
      {
        accessorKey: "hcNo",
        header: t("cert.hcNo"),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium">{row.original.hcNo}</span>
        ),
      },
      {
        id: "refNo",
        accessorFn: (row) => row.application.refNo,
        header: t("application.refNo"),
        cell: ({ row }) => (
          <Link
            href={`/applications/${row.original.application.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs text-primary hover:underline focus-visible:outline-2 rounded-sm"
          >
            {row.original.application.refNo}
          </Link>
        ),
      },
      {
        id: "applicant",
        accessorFn: (row) => row.application.applicant,
        header: t("application.applicant"),
        cell: ({ row }) => (
          <div className="min-w-0 max-w-52">
            <p className="truncate font-medium">{row.original.application.applicant}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.application.structureType}
            </p>
          </div>
        ),
      },
      {
        id: "airport",
        accessorFn: (row) => row.application.airportIcao,
        header: t("common.airport"),
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono">
            {row.original.application.airportIcao}
          </Badge>
        ),
      },
      {
        accessorKey: "ptE_amslM",
        header: "PTE (m AMSL)",
        cell: ({ row }) => (
          <div>
            <p className="font-medium tabular-nums">{formatMetres(row.original.ptE_amslM)}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatMetres(row.original.permissibleAglM)} AGL
            </p>
          </div>
        ),
      },
      {
        id: "validity",
        accessorFn: (row) => row.validTo,
        header: t("cert.validity"),
        cell: ({ row }) => {
          const { status, validFrom, validTo } = row.original;
          const remaining = new Date(validTo).getTime() - Date.now();
          const tone =
            status !== "ISSUED"
              ? "text-muted-foreground"
              : remaining < 0
                ? "text-destructive"
                : remaining < NINETY_DAYS_MS
                  ? "text-warning"
                  : "text-foreground";
          return (
            <div className={cn("text-xs tabular-nums", tone)}>
              <p>{formatDate(validFrom)}</p>
              <p>→ {formatDate(validTo)}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("common.status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("common.actions")}</span>,
        enableSorting: false,
        size: 48,
        cell: ({ row }) => {
          const cert = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${t("common.actions")} — ${cert.hcNo}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuLabel className="font-mono text-xs">{cert.hcNo}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => viewPdf(cert)}>
                  <FileText aria-hidden />
                  View PDF
                </DropdownMenuItem>
                {canManage && (cert.status === "ISSUED" || cert.status === "EXPIRED") && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setLifecycle({ cert, action: "revalidate" })}
                    >
                      <RotateCw aria-hidden />
                      Revalidate
                    </DropdownMenuItem>
                    {cert.status === "ISSUED" && (
                      <>
                        <DropdownMenuItem
                          onSelect={() => setLifecycle({ cert, action: "supersede" })}
                        >
                          <Copy aria-hidden />
                          Supersede
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setLifecycle({ cert, action: "expire" })}
                        >
                          <CalendarX aria-hidden />
                          Mark expired
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setLifecycle({ cert, action: "revoke" })}
                        >
                          <Ban aria-hidden />
                          Revoke
                        </DropdownMenuItem>
                      </>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [t, canManage, viewPdf]
  );

  const stats = data?.stats;

  return (
    <PageTransition className="p-4 md:p-6">
      <PageHeader
        crumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("nav.certificates") },
        ]}
        title={t("nav.certificates")}
        description="Height clearance certificate register — issuance, verification and lifecycle."
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} aria-hidden />
            {t("common.refresh")}
          </Button>
        }
      />

      {/* KPI cards */}
      <SkeletonSwap
        loading={isLoading}
        skeleton={
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        }
      >
        <Stagger className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t("status.ISSUED")}
            value={stats?.issued ?? 0}
            icon={FileCheck2}
            tone="success"
          />
          <StatCard
            label="Expiring in 90 days"
            value={stats?.expiring90 ?? 0}
            icon={CalendarClock}
            tone="warning"
          />
          <StatCard
            label={t("status.REVOKED")}
            value={stats?.revoked ?? 0}
            icon={Ban}
            tone="danger"
          />
          <StatCard
            label={t("status.EXPIRED")}
            value={stats?.expired ?? 0}
            icon={FileClock}
            tone="default"
          />
        </Stagger>
      </SkeletonSwap>

      {/* Approved — awaiting issuance (APPROVER/ADMIN) */}
      {canManage && (data?.approvedAwaiting.length ?? 0) > 0 && (
        <FadeIn className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BadgeCheck className="size-5 text-success" aria-hidden />
                Approved — awaiting issuance
                <Badge variant="secondary">{data!.approvedAwaiting.length}</Badge>
              </CardTitle>
              <CardDescription>
                Applications approved by the Director (ATM) that have not yet been issued a
                height clearance certificate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Stagger className="divide-y">
                {data!.approvedAwaiting.map((row) => (
                  <StaggerItem
                    key={row.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/applications/${row.id}`}
                        className="font-mono text-xs text-primary hover:underline focus-visible:outline-2 rounded-sm"
                      >
                        {row.refNo}
                      </Link>
                      <p className="truncate text-sm font-medium">{row.applicant}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.structureType} · {row.airportIcao} — {row.airportName}
                      </p>
                    </div>
                    <div className="hidden text-right text-xs sm:block">
                      <p className="text-muted-foreground">
                        {t("public.permissibleTopElevation")}
                      </p>
                      <p className="font-medium tabular-nums">
                        {row.evaluation?.ptE_amslM != null
                          ? `${formatMetres(row.evaluation.ptE_amslM)} AMSL`
                          : "—"}
                      </p>
                    </div>
                    <div className="hidden text-right text-xs md:block">
                      <p className="text-muted-foreground">{t("status.APPROVED")}</p>
                      <p className="tabular-nums">{formatDate(row.decidedAt)}</p>
                    </div>
                    <Button size="sm" onClick={() => setIssueRow(row)}>
                      <ScrollText className="size-4" aria-hidden />
                      Issue certificate
                    </Button>
                  </StaggerItem>
                ))}
              </Stagger>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Register table */}
      <DataTable<CertificateRow>
        columns={columns}
        data={data?.certificates ?? []}
        loading={isLoading}
        searchable
        searchPlaceholder={`${t("common.search")} — HC No, ${t("application.applicant").toLowerCase()}…`}
        initialSorting={[{ id: "hcNo", desc: true }]}
        onRowClick={(row) => router.push(`/applications/${row.application.id}`)}
        emptyTitle="No certificates found"
        emptyDescription="Certificates appear here once approved applications are issued."
        toolbar={
          <>
            <Select value={airportFilter} onValueChange={setAirportFilter}>
              <SelectTrigger className="h-9 w-40" aria-label={t("common.airport")}>
                <SelectValue placeholder={t("common.airport")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("common.all")} — {t("common.airport").toLowerCase()}s
                </SelectItem>
                {(airports ?? []).map((airport) => (
                  <SelectItem key={airport.icao} value={airport.icao}>
                    {airport.icao} — {airport.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-36" aria-label={t("common.status")}>
                <SelectValue placeholder={t("common.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("common.all")} — {t("common.status").toLowerCase()}
                </SelectItem>
                {(["ISSUED", "REVOKED", "EXPIRED", "SUPERSEDED"] as const).map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        exportCsv={{
          filename: "caab-certificates.csv",
          headers: [
            "HC No",
            "Application Ref",
            "Applicant",
            "Structure",
            "Airport",
            "PTE (m AMSL)",
            "Permissible AGL (m)",
            "Governing Surface",
            "Valid From",
            "Valid To",
            "Status",
            "Issued At",
            "Signed By",
          ],
          row: (item) => [
            item.hcNo,
            item.application.refNo,
            item.application.applicant,
            item.application.structureType,
            item.application.airportIcao,
            item.ptE_amslM.toFixed(2),
            item.permissibleAglM.toFixed(2),
            item.governingSurface ?? "",
            formatDate(item.validFrom),
            formatDate(item.validTo),
            item.status,
            formatDate(item.issuedAt),
            item.signedByName ?? "",
          ],
        }}
      />

      {/* Dialogs */}
      <IssueDialog row={issueRow} onOpenChange={(open) => !open && setIssueRow(null)} />
      <LifecycleDialog
        cert={lifecycle?.cert ?? null}
        action={lifecycle?.action ?? "revalidate"}
        onOpenChange={(open) => !open && setLifecycle(null)}
      />
    </PageTransition>
  );
}
