"use client";

// Drag-and-drop file upload (native DnD, no library) — one dropzone per
// document type. Validates PDF/PNG/JPEG ≤ 5 MB client-side, shows real
// upload progress and lists uploaded versions.
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, FileText, Image as ImageIcon, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ACCEPTED_MIME,
  MAX_FILE_BYTES,
  formatFileSize,
  type UploadedDoc,
} from "./types";

export function FileDropzone({
  label,
  hint,
  required = false,
  disabled = false,
  uploading = false,
  progress = null,
  documents = [],
  onFile,
  className,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  uploading?: boolean;
  progress?: number | null;
  documents?: UploadedDoc[];
  onFile: (file: File) => void;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputId = React.useId();

  const validateAndSend = React.useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      if (!ACCEPTED_MIME.includes(file.type)) {
        toast.error("Unsupported file type", {
          description: "Only PDF, PNG and JPEG files are accepted.",
        });
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error("File too large", {
          description: `${file.name} is ${formatFileSize(file.size)} — the limit is 5 MB.`,
        });
        return;
      }
      onFile(file);
    },
    [onFile]
  );

  const hasUpload = documents.length > 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={`Upload ${label}${required ? " (required)" : " (optional)"}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          validateAndSend(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "group relative flex cursor-pointer flex-col gap-1 rounded-lg border border-dashed bg-card px-4 py-3.5 transition-colors focus-visible:outline-2",
          dragging && "border-primary bg-primary/5",
          hasUpload && !dragging && "border-success/40 bg-success/[0.04]",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_MIME.join(",")}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            validateAndSend(e.target.files?.[0]);
            e.target.value = ""; // allow re-selecting the same file
          }}
        />
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
              hasUpload ? "bg-success/10 text-success" : "bg-muted text-muted-foreground group-hover:text-foreground"
            )}
            aria-hidden
          >
            {uploading ? (
              <Loader2 className="size-4.5 animate-spin" />
            ) : hasUpload ? (
              <CheckCircle2 className="size-4.5" />
            ) : (
              <UploadCloud className="size-4.5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {label}
              {required ? (
                <span className="ml-1 text-destructive" aria-hidden>
                  *
                </span>
              ) : (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {uploading
                ? "Uploading…"
                : hint ?? "Drag & drop or click to browse — PDF, PNG, JPEG · max 5 MB"}
            </p>
          </div>
          {!uploading && (
            <span className="hidden shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary sm:block">
              {hasUpload ? "Replace / add version" : "Browse"}
            </span>
          )}
        </div>
        {uploading && (
          <Progress
            value={progress ?? undefined}
            className="mt-1 h-1.5"
            aria-label={`Uploading ${label}`}
          />
        )}
      </div>

      {/* Uploaded versions */}
      <AnimatePresence initial={false}>
        {documents.map((doc) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-xs"
          >
            {doc.mimeType?.startsWith("image/") ? (
              <ImageIcon className="size-3.5 shrink-0 text-primary" aria-hidden />
            ) : (
              <FileText className="size-3.5 shrink-0 text-primary" aria-hidden />
            )}
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate font-medium hover:underline focus-visible:outline-2"
              title={doc.filename}
            >
              {doc.filename}
            </a>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              v{doc.version} · {formatFileSize(doc.sizeBytes)}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
