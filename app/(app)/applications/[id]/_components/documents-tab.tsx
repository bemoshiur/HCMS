"use client";

// Documents: typed, versioned list from GET /api/applications/[id]/documents.
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { FadeIn } from "@/components/motion";
import { useT } from "@/components/providers";
import { formatDateTime } from "@/lib/format";
import { fetchJson } from "../../_components/api";
import type { DocumentDto } from "../../_components/types";

const TYPE_LABELS: Record<string, string> = {
  OWNERSHIP: "Ownership",
  SITE_PLAN: "Site plan",
  ELEVATION_CERT: "Elevation certificate",
  MOUZA_MAP: "Mouza map",
  OTHER: "Other",
};

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsTab({ applicationId }: { applicationId: string }) {
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ["application", applicationId, "documents"],
    queryFn: () =>
      fetchJson<{ documents: DocumentDto[] }>(`/api/applications/${applicationId}/documents`),
  });

  if (isLoading) {
    return (
      <Card className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </Card>
    );
  }

  const documents = data?.documents ?? [];
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={Files}
        title="No documents on this case"
        description="Supporting documents are uploaded by the applicant through the portal."
      />
    );
  }

  return (
    <FadeIn>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Type</TableHead>
                <TableHead>Filename</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="text-center">Version</TableHead>
                <TableHead>Uploaded by</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="w-16 text-right">{t("common.download")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium">
                      <FileText className="size-4 text-primary" aria-hidden />
                      {TYPE_LABELS[doc.type] ?? doc.type}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-56 truncate" title={doc.filename}>
                    {doc.filename}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatSize(doc.sizeBytes)}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">v{doc.version}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {doc.uploadedBy?.name ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(doc.uploadedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="icon-sm" aria-label={`Download ${doc.filename}`}>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" download>
                        <Download className="size-4" aria-hidden />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </FadeIn>
  );
}
