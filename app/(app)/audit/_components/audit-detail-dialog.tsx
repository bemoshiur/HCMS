"use client";

// Readable before/after diff for a single audit record. Renders a field-by-field
// comparison with changed/added/removed keys highlighted — not a raw JSON dump.
// A null "before" reads as a creation; a null "after" reads as a deletion.
import * as React from "react";
import { ArrowRight, FilePlus2, FileX2, PencilLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AuditRow } from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function renderScalar(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

type RowStatus = "added" | "removed" | "changed" | "unchanged";

function diffRows(
  before: unknown,
  after: unknown
): { key: string; before: unknown; after: unknown; status: RowStatus }[] {
  const beforeObj = isPlainObject(before) ? before : {};
  const afterObj = isPlainObject(after) ? after : {};
  const keys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])).sort();

  return keys.map((key) => {
    const b = beforeObj[key];
    const a = afterObj[key];
    const inBefore = key in beforeObj;
    const inAfter = key in afterObj;
    let status: RowStatus = "unchanged";
    if (inBefore && !inAfter) status = "removed";
    else if (!inBefore && inAfter) status = "added";
    else if (JSON.stringify(b) !== JSON.stringify(a)) status = "changed";
    return { key, before: b, after: a, status };
  });
}

const STATUS_TINT: Record<RowStatus, string> = {
  added: "bg-success/5",
  removed: "bg-destructive/5",
  changed: "bg-warning/5",
  unchanged: "",
};

function ValueCell({
  value,
  muted,
  strike,
}: {
  value: unknown;
  muted?: boolean;
  strike?: boolean;
}) {
  const text = renderScalar(value);
  const isMultiline = text.includes("\n");
  return (
    <div
      className={cn(
        "min-w-0 break-words font-mono text-xs",
        muted && "text-muted-foreground",
        strike && "line-through decoration-destructive/50"
      )}
    >
      {isMultiline ? (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-muted/50 p-1.5">{text}</pre>
      ) : (
        text
      )}
    </div>
  );
}

export function AuditDetailDialog({
  record,
  onOpenChange,
}: {
  record: AuditRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = record != null;
  const mode: "created" | "deleted" | "updated" | "empty" = !record
    ? "empty"
    : record.before == null && record.after != null
      ? "created"
      : record.before != null && record.after == null
        ? "deleted"
        : "updated";

  const rows = React.useMemo(
    () => (record ? diffRows(record.before, record.after) : []),
    [record]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "created" && <FilePlus2 className="size-5 text-success" aria-hidden />}
            {mode === "deleted" && <FileX2 className="size-5 text-destructive" aria-hidden />}
            {(mode === "updated" || mode === "empty") && (
              <PencilLine className="size-5 text-primary" aria-hidden />
            )}
            <span className="font-mono text-sm">{record?.action}</span>
          </DialogTitle>
          <DialogDescription>
            {record && (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{formatDateTime(record.at)}</span>
                <span aria-hidden>·</span>
                <span>{record.actor?.name ?? "System"}</span>
                <span aria-hidden>·</span>
                <Badge variant="outline" className="font-mono">
                  {record.entity}
                  {record.entityId ? `#${record.entityId.slice(-8)}` : ""}
                </Badge>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {record && (
          <div className="space-y-3">
            {/* Change type banner */}
            <div className="flex items-center gap-2 text-sm">
              {mode === "created" && (
                <span className="inline-flex items-center rounded-full border border-success/25 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                  Created
                </span>
              )}
              {mode === "deleted" && (
                <span className="inline-flex items-center rounded-full border border-destructive/25 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                  Deleted
                </span>
              )}
              {mode === "updated" && (
                <span className="inline-flex items-center rounded-full border border-warning/25 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                  Updated
                </span>
              )}
              {record.ip && (
                <span className="text-xs text-muted-foreground">IP {record.ip}</span>
              )}
            </div>

            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                No structured field data was recorded for this event.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                {/* header */}
                <div className="grid grid-cols-[minmax(6rem,1fr)_1.4fr_auto_1.4fr] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Field</span>
                  <span>Before</span>
                  <span aria-hidden />
                  <span>After</span>
                </div>
                <div className="divide-y">
                  {rows.map((row) => (
                    <div
                      key={row.key}
                      className={cn(
                        "grid grid-cols-[minmax(6rem,1fr)_1.4fr_auto_1.4fr] items-start gap-2 px-3 py-2",
                        STATUS_TINT[row.status]
                      )}
                    >
                      <span className="min-w-0 break-words text-xs font-medium text-foreground">
                        {row.key}
                      </span>
                      <ValueCell
                        value={row.status === "added" ? undefined : row.before}
                        muted={row.status === "added" || row.status === "unchanged"}
                        strike={row.status === "removed"}
                      />
                      <ArrowRight
                        className={cn(
                          "size-3.5 self-center",
                          row.status === "unchanged"
                            ? "text-muted-foreground/30"
                            : "text-muted-foreground"
                        )}
                        aria-hidden
                      />
                      <ValueCell
                        value={row.status === "removed" ? undefined : row.after}
                        muted={row.status === "removed" || row.status === "unchanged"}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Audit records are immutable — this is a read-only view of what changed.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
