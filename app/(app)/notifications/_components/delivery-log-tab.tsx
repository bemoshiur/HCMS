"use client";

// Mocked EMAIL/SMS delivery log rendered as a DataTable. Demonstrates the
// dispatch that would otherwise hit an SMTP/SMS gateway.
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, Mail, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { FadeIn } from "@/components/motion";
import { formatDateTime } from "@/lib/format";
import { fetchJson } from "@/app/(app)/applications/_components/api";
import { cn } from "@/lib/utils";
import { humanizeEvent } from "./event-meta";
import type { DeliveryLogItem, DeliveryLogResponse } from "./types";

function ExpandableBody({ text }: { text: string }) {
  const [open, setOpen] = React.useState(false);
  const isLong = text.length > 80;
  return (
    <div className="max-w-md">
      <p className={cn("text-sm text-muted-foreground", !open && "line-clamp-1")}>{text}</p>
      {isLong && (
        <Button
          variant="link"
          size="xs"
          className="h-auto p-0 text-xs"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Show less" : "Show more"}
        </Button>
      )}
    </div>
  );
}

export function DeliveryLogTab() {
  const { data, isLoading } = useQuery<DeliveryLogResponse>({
    queryKey: ["notifications", "log"],
    queryFn: () => fetchJson<DeliveryLogResponse>("/api/notifications/log"),
  });

  const columns = React.useMemo<ColumnDef<DeliveryLogItem, unknown>[]>(
    () => [
      {
        accessorKey: "channel",
        header: "Channel",
        cell: ({ row }) => {
          const email = row.original.channel === "EMAIL";
          return (
            <Badge
              variant="outline"
              className={cn(
                "gap-1",
                email
                  ? "border-info/30 bg-info/10 text-info"
                  : "border-warning/30 bg-warning/10 text-warning"
              )}
            >
              {email ? <Mail className="size-3" aria-hidden /> : <MessageSquare className="size-3" aria-hidden />}
              {row.original.channel}
            </Badge>
          );
        },
      },
      {
        id: "event",
        accessorFn: (r) => humanizeEvent(r.event),
        header: "Event",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{humanizeEvent(row.original.event)}</span>
        ),
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        accessorKey: "recipient",
        header: "Recipient",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{row.original.recipient}</span>
        ),
      },
      {
        accessorKey: "body",
        header: "Message",
        enableSorting: false,
        cell: ({ row }) => <ExpandableBody text={row.original.body} />,
      },
      {
        accessorKey: "sentAt",
        header: "Sent",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDateTime(row.original.sentAt)}
          </span>
        ),
      },
    ],
    []
  );

  const exportCsv = {
    filename: "delivery-log.csv",
    headers: ["Channel", "Event", "Title", "Recipient", "Message", "Sent"],
    row: (n: DeliveryLogItem) => [
      n.channel,
      humanizeEvent(n.event),
      n.title,
      n.recipient,
      n.body,
      formatDateTime(n.sentAt),
    ],
  };

  return (
    <div className="space-y-4">
      <FadeIn className="flex items-start gap-2.5 rounded-lg border border-info/20 bg-info/5 px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Email &amp; SMS are mocked in this demo.</span>{" "}
          Messages are logged here instead of being dispatched to a real mail server or SMS gateway.
        </p>
      </FadeIn>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        searchable
        searchPlaceholder="Search messages…"
        exportCsv={exportCsv}
        emptyTitle="No messages sent"
        emptyDescription="Email and SMS notifications dispatched to you will be recorded here."
        initialSorting={[{ id: "sentAt", desc: true }]}
        pageSize={20}
      />
    </div>
  );
}
