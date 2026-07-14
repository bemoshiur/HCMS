"use client";

// Authority actions on a SUBMITTED case (§17): endorse & forward to CAAB
// (optional remarks + explicit confirmation) or return to the applicant
// (remarks required). Both go through POST /api/applications/[id]/transition,
// which handles legality, SLA, case events, audit and notifications.
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ApplicationStatus } from "@prisma/client";
import { Loader2, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { roleMayTransition } from "@/lib/workflow";
import { useT } from "@/components/providers";
import { fetchJson, type CaseDetailResponse } from "@/app/(app)/authority/_components/api";

type DialogKind = "endorse" | "return" | null;

const endorseSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
  confirm: z.boolean().refine((v) => v === true, "Please confirm before endorsing"),
});
type EndorseForm = z.infer<typeof endorseSchema>;

const returnSchema = z.object({
  remarks: z
    .string()
    .trim()
    .min(5, "Please provide at least 5 characters")
    .max(2000),
});
type ReturnForm = z.infer<typeof returnSchema>;

export function AuthorityActions({ detail }: { detail: CaseDetailResponse }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState<DialogKind>(null);
  const { application: app, viewer } = detail;

  const may = (to: ApplicationStatus) => roleMayTransition(viewer.role, app.status, to);
  const canEndorse = app.status === "SUBMITTED" && may("ENDORSED");
  const canReturn = app.status === "SUBMITTED" && may("RETURNED_FOR_INFO");

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["application", app.id] });
    queryClient.invalidateQueries({ queryKey: ["authority"] });
    queryClient.invalidateQueries({ queryKey: ["applications"] });
  }, [queryClient, app.id]);

  const transition = useMutation({
    mutationFn: (body: { to: ApplicationStatus; remarks?: string }) =>
      fetchJson(`/api/applications/${app.id}/transition`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });

  const endorseForm = useForm<EndorseForm>({
    resolver: zodResolver(endorseSchema),
    mode: "onChange",
    defaultValues: { remarks: "", confirm: false },
  });
  const returnForm = useForm<ReturnForm>({
    resolver: zodResolver(returnSchema),
    mode: "onChange",
    defaultValues: { remarks: "" },
  });

  const runTransition = (
    to: ApplicationStatus,
    remarks: string | undefined,
    successMessage: string
  ) =>
    transition.mutateAsync({ to, remarks }).then(
      () => {
        toast.success(successMessage);
        setOpen(null);
        endorseForm.reset();
        returnForm.reset();
        invalidate();
      },
      (e) => toast.error(e instanceof Error ? e.message : t("common.error"))
    );

  if (!canEndorse && !canReturn) return null;

  const pending = transition.isPending;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canEndorse && (
          <Button onClick={() => setOpen("endorse")}>
            <Send className="size-4" aria-hidden />
            Endorse &amp; forward to CAAB
          </Button>
        )}
        {canReturn && (
          <Button variant="outline" onClick={() => setOpen("return")}>
            <RotateCcw className="size-4" aria-hidden />
            Return to applicant
          </Button>
        )}
      </div>

      {/* Endorse & forward */}
      <Dialog open={open === "endorse"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <form
            onSubmit={endorseForm.handleSubmit((values) =>
              runTransition(
                "ENDORSED",
                values.remarks || undefined,
                "Application endorsed and forwarded to CAAB"
              )
            )}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Endorse &amp; forward to CAAB</DialogTitle>
              <DialogDescription>
                Forward {app.refNo} to CAAB for intake scrutiny. CAAB intake officers are
                notified and the applicant can track the progress.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="endorse-remarks">
                {t("common.remarks")}{" "}
                <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Textarea
                id="endorse-remarks"
                rows={3}
                placeholder="e.g. Land ownership and site particulars verified against our records…"
                {...endorseForm.register("remarks")}
              />
            </div>

            <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3">
              <Checkbox
                id="endorse-confirm"
                checked={endorseForm.watch("confirm")}
                onCheckedChange={(v) =>
                  endorseForm.setValue("confirm", v === true, { shouldValidate: true })
                }
                aria-describedby="endorse-confirm-label"
              />
              <Label
                id="endorse-confirm-label"
                htmlFor="endorse-confirm"
                className="text-sm font-normal leading-snug"
              >
                I confirm this application falls within{" "}
                <span className="font-medium">{app.authorityOrg?.name ?? "our authority"}</span>
                &apos;s jurisdiction and the enclosed particulars have been checked.
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(null)}
                disabled={pending}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={pending || !endorseForm.formState.isValid}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-4" aria-hidden />
                )}
                Endorse &amp; forward
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Return to applicant */}
      <Dialog open={open === "return"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <form
            onSubmit={returnForm.handleSubmit((values) =>
              runTransition("RETURNED_FOR_INFO", values.remarks, "Application returned to the applicant")
            )}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Return to applicant</DialogTitle>
              <DialogDescription>
                {app.refNo} is sent back to the applicant with your remarks. They can revise and
                resubmit through the portal — the applicant is notified.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="return-remarks">
                {t("common.remarks")}{" "}
                <span className="text-xs text-destructive">({t("common.required")})</span>
              </Label>
              <Textarea
                id="return-remarks"
                rows={4}
                placeholder="e.g. Mouza map missing; site coordinates do not match the deed…"
                aria-invalid={!!returnForm.formState.errors.remarks}
                {...returnForm.register("remarks")}
              />
              {returnForm.formState.errors.remarks && (
                <p className="text-xs text-destructive" role="alert">
                  {returnForm.formState.errors.remarks.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(null)}
                disabled={pending}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={pending || !returnForm.formState.isValid}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <RotateCcw className="size-4" aria-hidden />
                )}
                Return to applicant
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
