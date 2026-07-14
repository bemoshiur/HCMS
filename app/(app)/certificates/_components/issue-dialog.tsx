"use client";

// Issue-certificate dialog for an APPROVED application (approve → issue flow).
import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, BadgeCheck } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMetres } from "@/lib/format";
import { useT } from "@/components/providers";
import { fetchJson, type AwaitingRow, type CertificateRow } from "./types";

const schema = z.object({
  validityYears: z.enum(["1", "3", "5", "10"]),
});
type FormValues = z.infer<typeof schema>;

export function IssueDialog({
  row,
  onOpenChange,
}: {
  row: AwaitingRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { validityYears: "5" },
    mode: "onChange",
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      fetchJson<{ certificate: CertificateRow }>("/api/certificates/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: row!.id,
          validityYears: Number(values.validityYears),
        }),
      }),
    onSuccess: (data) => {
      toast.success(`Certificate ${data.certificate.hcNo} issued`, {
        description: `Application ${row?.refNo} moved to Certificate Issued.`,
      });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(t("common.error"), { description: error.message });
    },
  });

  const pte = row?.evaluation?.ptE_amslM;
  const agl = row?.evaluation?.permissibleAglM;

  return (
    <Dialog open={row !== null} onOpenChange={(open) => !mutation.isPending && onOpenChange(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeCheck className="size-5 text-success" aria-hidden />
            Issue certificate
          </DialogTitle>
          <DialogDescription>
            Issues a GRANTED height clearance certificate with a canonical HC number and QR
            verification, and moves the application to Certificate Issued.
          </DialogDescription>
        </DialogHeader>

        {row && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
            <p className="font-mono text-xs text-muted-foreground">{row.refNo}</p>
            <p className="font-medium">{row.applicant}</p>
            <p className="text-muted-foreground">
              {row.structureType} · {row.airportIcao} — {row.airportName}
            </p>
            <p className="text-muted-foreground">
              {t("public.permissibleTopElevation")}:{" "}
              <span className="font-medium text-foreground">
                {pte != null ? `${formatMetres(pte)} AMSL` : "—"}
              </span>
              {agl != null && <> ({formatMetres(agl)} AGL)</>}
            </p>
          </div>
        )}

        <form
          id="issue-certificate-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-2"
        >
          <Label htmlFor="validity-years">{t("cert.validity")}</Label>
          <Controller
            control={form.control}
            name="validityYears"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="validity-years" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["1", "3", "5", "10"] as const).map((years) => (
                    <SelectItem key={years} value={years}>
                      {years} {Number(years) === 1 ? "year" : "years"}
                      {years === "5" ? " (standard)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.validityYears && (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.validityYears.message}
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
            form="issue-certificate-form"
            disabled={!form.formState.isValid || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {mutation.isPending ? t("common.submitting") : "Issue certificate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
