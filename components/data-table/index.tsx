"use client";

/**
 * Reusable data table (§4: every list is a real data table).
 * TanStack Table with: column sort, global search, multi-filter slots,
 * pagination, row selection + bulk actions, CSV export, loading skeletons,
 * empty state, staggered row entrance.
 */
import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Search,
  SearchX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { toCsv, downloadBlob } from "@/lib/format";
import { useT } from "@/components/providers";
import { cn } from "@/lib/utils";

export type { ColumnDef };

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  loading?: boolean;
  /** Enables the global search box. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Extra filter controls rendered in the toolbar. */
  toolbar?: React.ReactNode;
  /** Enables row selection; bulk actions receive the selected rows. */
  bulkActions?: (rows: TData[], clear: () => void) => React.ReactNode;
  /** CSV export: filename + row mapper. Omit to hide the export button. */
  exportCsv?: {
    filename: string;
    headers: string[];
    row: (item: TData) => (string | number | null | undefined)[];
  };
  onRowClick?: (row: TData) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  initialSorting?: SortingState;
  pageSize?: number;
  className?: string;
}

export function DataTable<TData>({
  columns: userColumns,
  data,
  loading = false,
  searchable = true,
  searchPlaceholder,
  toolbar,
  bulkActions,
  exportCsv,
  onRowClick,
  emptyTitle,
  emptyDescription,
  emptyAction,
  initialSorting = [],
  pageSize = 10,
  className,
}: DataTableProps<TData>) {
  const t = useT();
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  const columns = React.useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (!bulkActions) return userColumns;
    const selectColumn: ColumnDef<TData, unknown> = {
      id: "__select",
      size: 36,
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label={t("common.selectAll")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select row"
        />
      ),
    };
    return [selectColumn, ...userColumns];
  }, [userColumns, bulkActions, t]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, rowSelection, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    globalFilterFn: "includesString",
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const clearSelection = React.useCallback(() => setRowSelection({}), []);

  const handleExport = React.useCallback(() => {
    if (!exportCsv) return;
    const rows = table.getFilteredRowModel().rows.map((r) => exportCsv.row(r.original));
    downloadBlob(toCsv(exportCsv.headers, rows), exportCsv.filename);
  }, [exportCsv, table]);

  const pageRows = table.getRowModel().rows;
  const totalRows = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {searchable && (
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder ?? t("common.search")}
              className="h-9 w-56 pl-8"
              aria-label={t("common.search")}
            />
          </div>
        )}
        {toolbar}
        <div className="ml-auto flex items-center gap-2">
          {bulkActions && selectedRows.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-md border bg-accent/60 px-2 py-1"
            >
              <span className="text-xs font-medium text-accent-foreground">
                {selectedRows.length} {t("common.selected")}
              </span>
              {bulkActions(selectedRows, clearSelection)}
            </motion.div>
          )}
          {exportCsv && (
            <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || totalRows === 0}>
              <Download className="size-4" aria-hidden />
              {t("common.exportCsv")}
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      aria-sort={
                        sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                      }
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 rounded-sm font-medium hover:text-foreground transition-colors focus-visible:outline-2"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3.5" aria-hidden />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3.5" aria-hidden />
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <EmptyState
                    icon={SearchX}
                    title={emptyTitle ?? t("common.noResults")}
                    description={emptyDescription}
                    action={emptyAction}
                    className="border-0 rounded-none"
                  />
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row, index) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.035, 0.4), ease: [0.22, 1, 0.36, 1] }}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    "border-b transition-colors hover:bg-accent/50 data-[state=selected]:bg-accent",
                    onRowClick && "cursor-pointer"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>
            {totalRows.toLocaleString()} {t("common.rows")}
          </span>
          <Select
            value={String(currentPageSize)}
            onValueChange={(v) => table.setPageSize(Number(v))}
          >
            <SelectTrigger className="h-8 w-[110px]" size="sm" aria-label={t("common.perPage")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / {t("common.page").toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-2 tabular-nums">
            {t("common.page")} {pageIndex + 1} {t("common.of")} {Math.max(1, table.getPageCount())}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            aria-label="First page"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label={t("common.previous")}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label={t("common.next")}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            aria-label="Last page"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
