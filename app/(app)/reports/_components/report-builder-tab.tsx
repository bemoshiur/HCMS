"use client";

/**
 * Report Builder tab — entity + column multi-select + filters (RHF + Zod),
 * JSON preview via POST /api/reports/build, then CSV (server, ≤5000 rows),
 * Excel (.xls generated client-side from the preview) and PDF (print view).
 */
import * as React from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format as fmt } from "date-fns";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { useT } from "@/components/providers";
import { downloadBlob } from "@/lib/format";
import {
  ENTITY_COLUMNS,
  ENTITY_LABELS,
  ENTITY_STATUSES,
  fetchJson,
  type AirportOption,
  type BuildPreview,
  type Cell,
  type ReportEntity,
} from "./types";

const ALL = "__all__";

const builderSchema = z.object({
  entity: z.enum(["applications", "certificates", "obstacles"]),
  columns: z.array(z.string()).min(1, "Select at least one column"),
  icao: z.string().optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  structureType: z.string().max(80).optional(),
});
type BuilderValues = z.infer<typeof builderSchema>;

function defaultColumns(entity: ReportEntity): string[] {
  return ENTITY_COLUMNS[entity].filter((c) => c.default).map((c) => c.key);
}

function buildBody(values: BuilderValues, format: "json" | "csv") {
  return {
    entity: values.entity,
    columns: values.columns,
    format,
    filters: {
      ...(values.icao && values.icao !== ALL ? { icao: values.icao } : {}),
      ...(values.status && values.status !== ALL ? { status: values.status } : {}),
      ...(values.from ? { from: values.from } : {}),
      ...(values.to ? { to: values.to } : {}),
      ...(values.structureType ? { structureType: values.structureType } : {}),
    },
  };
}

const escapeHtml = (v: Cell) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function ReportBuilderTab() {
  const t = useT();
  const [preview, setPreview] = React.useState<BuildPreview | null>(null);
  const [previewEntity, setPreviewEntity] = React.useState<ReportEntity>("applications");

  const airportsQ = useQuery({
    queryKey: ["airports"],
    queryFn: () => fetchJson<AirportOption[]>("/api/airports"),
    staleTime: 10 * 60_000,
  });

  const form = useForm<BuilderValues>({
    resolver: zodResolver(builderSchema),
    mode: "onChange",
    defaultValues: {
      entity: "applications",
      columns: defaultColumns("applications"),
      icao: ALL,
      status: ALL,
      from: "",
      to: "",
      structureType: "",
    },
  });
  const entity = form.watch("entity");
  const columns = form.watch("columns");

  // ── Preview (format json) ──
  const previewM = useMutation({
    mutationFn: async (values: BuilderValues) =>
      fetchJson<BuildPreview>("/api/reports/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(values, "json")),
      }),
    onSuccess: (data, values) => {
      setPreview(data);
      setPreviewEntity(values.entity);
      toast.success("Preview generated", {
        description: `Showing ${data.rows.length.toLocaleString("en-US")} of ${data.total.toLocaleString("en-US")} rows`,
      });
    },
    onError: (error: Error) => toast.error("Preview failed", { description: error.message }),
  });

  // ── Export CSV (server-built, up to 5000 rows) ──
  const csvM = useMutation({
    mutationFn: async (values: BuilderValues) => {
      const res = await fetch("/api/reports/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(values, "csv")),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Export failed (${res.status})`);
      }
      return res.blob();
    },
    onSuccess: (blob, values) => {
      const filename = `hcms-${values.entity}-report-${fmt(new Date(), "yyyyMMdd-HHmm")}.csv`;
      downloadBlob(blob, filename);
      toast.success("CSV export started", { description: filename });
    },
    onError: (error: Error) => toast.error("CSV export failed", { description: error.message }),
  });

  // ── Export Excel (.xls from the previewed rows) ──
  const handleExcel = React.useCallback(() => {
    if (!preview) return;
    const head = preview.headers.map((h) => `<th style="background:#eef2f7;text-align:left">${escapeHtml(h)}</th>`).join("");
    const body = preview.rows
      .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
      .join("");
    const html =
      `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">` +
      `<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>` +
      `<x:Name>${escapeHtml(ENTITY_LABELS[previewEntity])}</x:Name><x:WorksheetOptions/></x:ExcelWorksheet>` +
      `</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>` +
      `<body><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    const filename = `hcms-${previewEntity}-report-${fmt(new Date(), "yyyyMMdd-HHmm")}.xls`;
    downloadBlob(new Blob(["﻿", html], { type: "application/vnd.ms-excel" }), filename);
    toast.success("Excel export started", {
      description: `${filename} — contains the ${preview.rows.length.toLocaleString("en-US")} previewed rows`,
    });
  }, [preview, previewEntity]);

  // ── Export PDF (print-optimised view of the preview) ──
  const handlePrint = React.useCallback(() => {
    if (!preview) return;
    window.print();
  }, [preview]);

  const onPreview = form.handleSubmit((values) => previewM.mutate(values));
  const onExportCsv = form.handleSubmit((values) => csvM.mutate(values));

  function handleEntityChange(next: ReportEntity) {
    form.setValue("entity", next, { shouldValidate: true });
    form.setValue("columns", defaultColumns(next), { shouldValidate: true });
    form.setValue("status", ALL, { shouldValidate: true });
  }

  // Preview table columns — index-accessed cells with status badges where obvious.
  const previewColumns = React.useMemo<ColumnDef<Cell[], unknown>[]>(() => {
    if (!preview) return [];
    return preview.headers.map((header, i) => ({
      id: `col-${i}`,
      header,
      accessorFn: (row: Cell[]) => row[i] ?? "",
      cell: ({ row }) => {
        const value = row.original[i];
        if (value == null || value === "") {
          return <span className="text-muted-foreground">—</span>;
        }
        if (header === "Status" || header === "Evaluation") {
          return <StatusBadge status={String(value)} />;
        }
        if (typeof value === "number") {
          return (
            <span className="tabular-nums">
              {value.toLocaleString("en-US", { maximumFractionDigits: 4 })}
            </span>
          );
        }
        return <span className="block max-w-56 truncate">{String(value)}</span>;
      },
    }));
  }, [preview]);

  const columnsError = form.formState.errors.columns?.message;
  const statuses = ENTITY_STATUSES[entity];

  return (
    <div className="space-y-4">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Table2 className="size-4 text-muted-foreground" aria-hidden />
            Build a report
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <form onSubmit={onPreview} className="space-y-4" noValidate>
            {/* ── Entity + filters ── */}
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="rb-entity" className="text-xs text-muted-foreground">
                  Dataset
                </Label>
                <Select value={entity} onValueChange={(v) => handleEntityChange(v as ReportEntity)}>
                  <SelectTrigger id="rb-entity" className="h-9 w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ENTITY_LABELS) as ReportEntity[]).map((e) => (
                      <SelectItem key={e} value={e}>
                        {ENTITY_LABELS[e]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="rb-airport" className="text-xs text-muted-foreground">
                  {t("common.airport")}
                </Label>
                <Controller
                  control={form.control}
                  name="icao"
                  render={({ field }) => (
                    <Select value={field.value ?? ALL} onValueChange={field.onChange}>
                      <SelectTrigger id="rb-airport" className="h-9 w-44">
                        <SelectValue placeholder={t("common.all")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>{t("common.all")}</SelectItem>
                        {(airportsQ.data ?? []).map((a) => (
                          <SelectItem key={a.icao} value={a.icao}>
                            {a.icao} — {a.city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="rb-status" className="text-xs text-muted-foreground">
                  {t("common.status")}
                </Label>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value ?? ALL} onValueChange={field.onChange}>
                      <SelectTrigger id="rb-status" className="h-9 w-48">
                        <SelectValue placeholder={t("common.all")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>{t("common.all")}</SelectItem>
                        {statuses.map((s) => (
                          <SelectItem key={s} value={s}>
                            {t(`status.${s}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="rb-from" className="text-xs text-muted-foreground">
                  {t("common.from")}
                </Label>
                <Input id="rb-from" type="date" className="h-9 w-38" {...form.register("from")} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="rb-to" className="text-xs text-muted-foreground">
                  {t("common.to")}
                </Label>
                <Input id="rb-to" type="date" className="h-9 w-38" {...form.register("to")} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="rb-structure" className="text-xs text-muted-foreground">
                  {t("application.structureType")}
                </Label>
                <Input
                  id="rb-structure"
                  placeholder="e.g. Building"
                  className="h-9 w-44"
                  maxLength={80}
                  {...form.register("structureType")}
                />
              </div>
            </div>

            <Separator />

            {/* ── Column multi-select ── */}
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-muted-foreground">
                Columns ({columns.length} selected)
              </legend>
              <Controller
                control={form.control}
                name="columns"
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {ENTITY_COLUMNS[entity].map((col) => {
                      const checked = field.value.includes(col.key);
                      return (
                        <label
                          key={col.key}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              field.onChange(
                                v
                                  ? [...field.value, col.key]
                                  : field.value.filter((k) => k !== col.key)
                              )
                            }
                            aria-label={col.label}
                          />
                          <span className="truncate">{col.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              />
              {columnsError && (
                <p role="alert" className="mt-2 text-xs font-medium text-destructive">
                  {columnsError}
                </p>
              )}
            </fieldset>

            {/* ── Actions ── */}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={!form.formState.isValid || previewM.isPending}>
                {previewM.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Table2 className="size-4" aria-hidden />
                )}
                {previewM.isPending ? t("common.loading") : "Preview"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onExportCsv}
                disabled={!form.formState.isValid || csvM.isPending}
              >
                {csvM.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="size-4" aria-hidden />
                )}
                {t("common.exportCsv")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleExcel}
                disabled={!preview || preview.rows.length === 0}
              >
                <FileSpreadsheet className="size-4" aria-hidden />
                {t("common.exportExcel")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handlePrint}
                disabled={!preview || preview.rows.length === 0}
              >
                <Printer className="size-4" aria-hidden />
                {t("common.exportPdf")}
              </Button>
              <p className="basis-full text-xs text-muted-foreground sm:ml-auto sm:basis-auto">
                CSV exports up to 5,000 rows; Excel and PDF export the previewed rows (≤200).
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Preview ── */}
      {preview ? (
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium">
              <FileText className="size-4 text-muted-foreground" aria-hidden />
              Preview — {ENTITY_LABELS[previewEntity]}
              <span className="font-normal text-muted-foreground">
                {preview.rows.length.toLocaleString("en-US")} {t("common.of")}{" "}
                {preview.total.toLocaleString("en-US")} {t("common.rows")}
                {preview.total > preview.limit &&
                  ` (preview capped at ${preview.limit.toLocaleString("en-US")})`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <DataTable<Cell[]>
              columns={previewColumns}
              data={preview.rows}
              loading={previewM.isPending}
              searchable={false}
              pageSize={10}
              emptyTitle={t("common.noResults")}
              emptyDescription="Adjust the filters and generate the preview again."
            />
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={Table2}
          title="No preview yet"
          description="Choose a dataset, tick the columns you need and select Preview to see the report."
        />
      )}

      {/* ── Print-only view (Export PDF → browser print dialog) ── */}
      {preview && (
        <div id="hcms-report-print" aria-hidden className="hidden">
          <h1>CAAB HCMS — {ENTITY_LABELS[previewEntity]} report</h1>
          <p>
            Generated {fmt(new Date(), "dd MMM yyyy, HH:mm")} · {preview.rows.length} of{" "}
            {preview.total} rows
            {preview.total > preview.limit ? ` (capped at ${preview.limit})` : ""}
          </p>
          <table>
            <thead>
              <tr>
                {preview.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{c == null || c === "" ? "—" : String(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="print-footnote">
            Civil Aviation Authority of Bangladesh — Height Clearance Management System.
            Demonstration build; confirm figures against CAAB AIP.
          </p>
        </div>
      )}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #hcms-report-print, #hcms-report-print * { visibility: visible !important; }
          #hcms-report-print {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 24px;
            background: #fff;
            color: #111;
            font-size: 11px;
          }
          #hcms-report-print h1 { font-size: 16px; font-weight: 600; margin: 0 0 4px; }
          #hcms-report-print p { margin: 0 0 12px; color: #444; }
          #hcms-report-print table { width: 100%; border-collapse: collapse; }
          #hcms-report-print th, #hcms-report-print td {
            border: 1px solid #ccc;
            padding: 4px 6px;
            text-align: left;
            vertical-align: top;
          }
          #hcms-report-print th { background: #f1f4f8; font-weight: 600; }
          #hcms-report-print .print-footnote { margin-top: 12px; font-size: 10px; color: #666; }
        }
      `}</style>
    </div>
  );
}
