"use client";

// Revoke / revalidate / supersede / expire dialog with remarks (RHF + Zod).
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Ban, RotateCw, Copy, CalendarX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/components/providers";
import {
  fetchJson,
  type CertificateRow,
  type LifecycleAction,
} from "./types";

const COPY: Record<
  LifecycleAction,
  {
    title: string;
    description: (hcNo: string) => string;
    confirm: string;
    destructive: boolean;
    remarksRequired: boolean;
    icon: React.ElementType;
  }
> = {
  revoke: {
    title: "Revoke certificate",
    description: (hcNo) =>
      `Permanently revokes ${hcNo} and marks the application as Revoked. The certificate will fail public verification. This cannot be undone.`,
    confirm: "Revoke certificate",
    destructive: true,
    remarksRequired: true,
    icon: Ban,
  },
  revalidate: {
    title: "Revalidate certificate",
    description: (hcNo) =>
      `Extends the validity of ${hcNo} for 5 years from today. The certificate remains issued and continues to verify publicly.`,
    confirm: "Revalidate",
    destructive: false,
    remarksRequired: false,
    icon: RotateCw,
  },
  supersede: {
    title: "Supersede certificate",
    description: (hcNo) =>
      `Issues a replacement certificate with a fresh HC number, QR token and 5-year validity. ${hcNo} will be marked Superseded and will no longer verify as valid.`,
    confirm: "Supersede",
    destructive: false,
    remarksRequired: false,
    icon: Copy,
  },
  expire: {
    title: "Mark certificate expired",
    description: (hcNo) =>
      `Marks ${hcNo} as Expired and moves the application to Expired. The applicant may later request revalidation.`,
    confirm: "Mark expired",
    destructive: true,
    remarksRequired: false,
    icon: CalendarX,
  },
};

export function LifecycleDialog({
  cert,
  action,
  onOpenChange,
}: {
  cert: CertificateRow | null;
  action: LifecycleAction;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const copy = COPY[action];
  const Icon = copy.icon;

  const schema = React.useMemo(
    () =>
      z.object({
        remarks: copy.remarksRequired
          ? z
              .string()
              .trim()
              .min(5, "Please provide the reason (at least 5 characters)")
              .max(2000)
          : z.string().trim().max(2000).optional(),
      }),
    [copy.remarksRequired]
  );
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { remarks: "" },
    mode: "onChange",
  });

  // Reset the form whenever a new certificate/action opens the dialog.
  React.useEffect(() => {
    if (cert) form.reset({ remarks: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cert?.id, action]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      fetchJson<{ certificate: CertificateRow; newCertificate: CertificateRow | null }>(
        `/api/certificates/${cert!.id}/lifecycle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, remarks: values.remarks || undefined }),
        }
      ),
    onSuccess: (data) => {
      if (action === "supersede" && data.newCertificate) {
        toast.success(`Certificate superseded by ${data.newCertificate.hcNo}`);
      } else if (action === "revoke") {
        toast.success(`Certificate ${cert?.hcNo} revoked`);
      } else if (action === "expire") {
        toast.success(`Certificate ${cert?.hcNo} marked expired`);
      } else {
        toast.success(`Certificate ${cert?.hcNo} revalidated`);
      }
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(t("common.error"), { description: error.message });
    },
  });

  return (
    <Dialog open={cert !== null} onOpenChange={(open) => !mutation.isPending && onOpenChange(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon
              className={copy.destructive ? "size-5 text-destructive" : "size-5 text-primary"}
              aria-hidden
            />
            {copy.title}
          </DialogTitle>
          <DialogDescription>{cert ? copy.description(cert.hcNo) : null}</DialogDescription>
        </DialogHeader>

        {cert && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-0.5">
            <p className="font-mono text-xs text-muted-foreground">{cert.hcNo}</p>
            <p className="font-medium">{cert.application.applicant}</p>
            <p className="text-muted-foreground">
              {cert.application.refNo} · {cert.application.airportIcao}
            </p>
          </div>
        )}

        <form
          id="lifecycle-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-2"
        >
          <Label htmlFor="lifecycle-remarks">
            {t("common.remarks")}
            {!copy.remarksRequired && (
              <span className="text-muted-foreground font-normal"> ({t("common.optional")})</span>
            )}
          </Label>
          <Textarea
            id="lifecycle-remarks"
            rows={3}
            placeholder={
              copy.remarksRequired
                ? "State the reason for revocation…"
                : "Add remarks for the case record…"
            }
            aria-invalid={!!form.formState.errors.remarks}
            {...form.register("remarks")}
          />
          {form.formState.errors.remarks && (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.remarks.message}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="lifecycle-form"
            variant={copy.destructive ? "destructive" : "default"}
            disabled={!form.formState.isValid || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {mutation.isPending ? t("common.submitting") : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
