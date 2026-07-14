"use client";

// Role-dependent case actions (§17): start scrutiny, accept & assign,
// return-for-info, reject, approve, escalate. Every mutation confirms via a
// dialog, validates with RHF + Zod and reports through toasts.
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ApplicationStatus } from "@prisma/client";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  PlayCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { roleMayTransition } from "@/lib/workflow";
import { useT } from "@/components/providers";
import { fetchJson } from "../../_components/api";
import type { DetailResponse } from "../../_components/types";

type DialogKind =
  | "start-scrutiny"
  | "accept-assign"
  | "return-info"
  | "reject"
  | "approve"
  | "escalate"
  | null;

const remarksSchema = z.object({
  remarks: z.string().trim().min(5, "Please provide at least 5 characters").max(2000),
});
type RemarksForm = z.infer<typeof remarksSchema>;

const approveSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
});
type ApproveForm = z.infer<typeof approveSchema>;

const assignSchema = z.object({
  cns: z.boolean(),
  pansops: z.boolean(),
  officerId: z.string().optional(),
});
type AssignForm = z.infer<typeof assignSchema>;

export function CaseActions({ detail }: { detail: DetailResponse }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState<DialogKind>(null);
  const { application: app, viewer, assignableOfficers } = detail;

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["application", app.id] });
    queryClient.invalidateQueries({ queryKey: ["applications"] });
  }, [queryClient, app.id]);

  const transition = useMutation({
    mutationFn: (body: { to: ApplicationStatus; remarks?: string }) =>
      fetchJson(`/api/applications/${app.id}/transition`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });

  const may = (to: ApplicationStatus) => roleMayTransition(viewer.role, app.status, to);

  const runTransition = (
    to: ApplicationStatus,
    remarks: string | undefined,
    successMessage: string
  ) =>
    transition.mutateAsync({ to, remarks }).then(
      () => {
        toast.success(successMessage);
        setOpen(null);
        invalidate();
      },
      (e) => toast.error(e instanceof Error ? e.message : t("common.error"))
    );

  // ── forms ──
  const returnForm = useForm<RemarksForm>({
    resolver: zodResolver(remarksSchema),
    mode: "onChange",
    defaultValues: { remarks: "" },
  });
  const rejectForm = useForm<RemarksForm>({
    resolver: zodResolver(remarksSchema),
    mode: "onChange",
    defaultValues: { remarks: "" },
  });
  const approveForm = useForm<ApproveForm>({
    resolver: zodResolver(approveSchema),
    mode: "onChange",
    defaultValues: { remarks: "" },
  });
  const escalateForm = useForm<RemarksForm>({
    resolver: zodResolver(remarksSchema),
    mode: "onChange",
    defaultValues: { remarks: "" },
  });
  const assignForm = useForm<AssignForm>({
    resolver: zodResolver(assignSchema),
    mode: "onChange",
    defaultValues: {
      cns: app.assignedDisciplines.includes("CNS"),
      pansops: app.assignedDisciplines.includes("PANSOPS"),
      officerId: app.assignedOfficer?.id ?? undefined,
    },
  });

  const acceptAssign = useMutation({
    mutationFn: async (values: AssignForm) => {
      const disciplines = ["AGA", ...(values.cns ? ["CNS"] : []), ...(values.pansops ? ["PANSOPS"] : [])];
      await fetchJson(`/api/applications/${app.id}/assign`, {
        method: "POST",
        body: JSON.stringify({
          disciplines,
          officerId: values.officerId || undefined,
        }),
      });
      await fetchJson(`/api/applications/${app.id}/transition`, {
        method: "POST",
        body: JSON.stringify({ to: "UNDER_REVIEW" }),
      });
    },
    onSuccess: () => {
      toast.success("Case accepted — disciplines assigned and moved to review");
      setOpen(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  const escalate = useMutation({
    mutationFn: (values: RemarksForm) =>
      fetchJson(`/api/applications/${app.id}/message`, {
        method: "POST",
        body: JSON.stringify({ note: values.remarks, escalate: true }),
      }),
    onSuccess: () => {
      toast.success("Case escalated — internal note recorded");
      setOpen(null);
      escalateForm.reset();
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  // ── visible buttons ──
  const buttons: React.ReactNode[] = [];

  if (viewer.canIntake && app.status === "ENDORSED" && may("INTAKE_SCRUTINY")) {
    buttons.push(
      <Button key="scrutiny" onClick={() => setOpen("start-scrutiny")}>
        <PlayCircle className="size-4" aria-hidden />
        Start scrutiny
      </Button>
    );
  }
  if (viewer.canIntake && app.status === "INTAKE_SCRUTINY") {
    if (may("UNDER_REVIEW")) {
      buttons.push(
        <Button key="accept" onClick={() => setOpen("accept-assign")}>
          <ClipboardCheck className="size-4" aria-hidden />
          Accept &amp; assign
        </Button>
      );
    }
    if (may("RETURNED_FOR_INFO")) {
      buttons.push(
        <Button key="return" variant="outline" onClick={() => setOpen("return-info")}>
          <RotateCcw className="size-4" aria-hidden />
          Return for info
        </Button>
      );
    }
    if (may("REJECTED")) {
      buttons.push(
        <Button key="reject" variant="destructive" onClick={() => setOpen("reject")}>
          <XCircle className="size-4" aria-hidden />
          Reject
        </Button>
      );
    }
  }
  if (viewer.canDecide && app.status === "DECISION_PENDING") {
    if (may("APPROVED")) {
      buttons.push(
        <Button key="approve" onClick={() => setOpen("approve")}>
          <CheckCircle2 className="size-4" aria-hidden />
          Approve
        </Button>
      );
    }
    if (may("REJECTED")) {
      buttons.push(
        <Button key="reject-final" variant="destructive" onClick={() => setOpen("reject")}>
          <XCircle className="size-4" aria-hidden />
          Reject
        </Button>
      );
    }
  }
  if (viewer.isCaab && viewer.role !== "AUDITOR") {
    buttons.push(
      <Button key="escalate" variant="ghost" onClick={() => setOpen("escalate")}>
        <ArrowUpRight className="size-4" aria-hidden />
        Escalate
      </Button>
    );
  }

  const pending = transition.isPending || acceptAssign.isPending || escalate.isPending;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">{buttons}</div>

      {/* Start scrutiny */}
      <Dialog open={open === "start-scrutiny"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start intake scrutiny</DialogTitle>
            <DialogDescription>
              Move case {app.refNo} into intake scrutiny. Documents and site details will be
              checked before assignment to discipline review.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() =>
                runTransition("INTAKE_SCRUTINY", undefined, "Intake scrutiny started")
              }
              disabled={pending}
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept & assign */}
      <Dialog open={open === "accept-assign"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={assignForm.handleSubmit((values) => acceptAssign.mutate(values))}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Accept &amp; assign for review</DialogTitle>
              <DialogDescription>
                Select the review disciplines for {app.refNo}. The OLS evaluation is recomputed
                and stored, and the case moves to Under Review.
              </DialogDescription>
            </DialogHeader>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("application.disciplines")}</legend>
              <div className="flex items-center gap-2">
                <Checkbox id="d-aga" checked disabled aria-label="AGA (mandatory)" />
                <Label htmlFor="d-aga" className="text-sm">
                  AGA — Aerodromes &amp; Ground Aids
                  <span className="ml-1 text-xs text-muted-foreground">(mandatory)</span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="d-cns"
                  checked={assignForm.watch("cns")}
                  onCheckedChange={(v) => assignForm.setValue("cns", !!v, { shouldValidate: true })}
                />
                <Label htmlFor="d-cns" className="text-sm">
                  CNS — Communication, Navigation &amp; Surveillance
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="d-pansops"
                  checked={assignForm.watch("pansops")}
                  onCheckedChange={(v) =>
                    assignForm.setValue("pansops", !!v, { shouldValidate: true })
                  }
                />
                <Label htmlFor="d-pansops" className="text-sm">
                  PANS-OPS — Flight Procedures
                </Label>
              </div>
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="assign-officer" className="text-sm font-medium">
                Case officer <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Select
                value={assignForm.watch("officerId") ?? ""}
                onValueChange={(v) =>
                  assignForm.setValue("officerId", v || undefined, { shouldValidate: true })
                }
              >
                <SelectTrigger id="assign-officer" className="w-full">
                  <SelectValue placeholder="Select an officer" />
                </SelectTrigger>
                <SelectContent>
                  {assignableOfficers.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {t(`roles.${o.role}`)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(null)}
                disabled={acceptAssign.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={acceptAssign.isPending || !assignForm.formState.isValid}>
                {acceptAssign.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Accept &amp; assign
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Return for info */}
      <Dialog open={open === "return-info"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <form
            onSubmit={returnForm.handleSubmit((values) =>
              runTransition("RETURNED_FOR_INFO", values.remarks, "Returned to applicant for information")
            )}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Return for information</DialogTitle>
              <DialogDescription>
                The case is returned to the applicant. State clearly what is missing or requires
                correction — the applicant is notified.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="return-remarks">{t("common.remarks")}</Label>
              <Textarea
                id="return-remarks"
                rows={4}
                placeholder="e.g. Site plan illegible; mouza map missing…"
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
              <Button type="button" variant="outline" onClick={() => setOpen(null)} disabled={pending}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={pending || !returnForm.formState.isValid}>
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Return for info
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={open === "reject"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <form
            onSubmit={rejectForm.handleSubmit((values) =>
              runTransition("REJECTED", values.remarks, "Application rejected")
            )}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Reject application</DialogTitle>
              <DialogDescription>
                This is a terminal decision for {app.refNo}. Provide the reasons — they are
                recorded on the case and the applicant is notified.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="reject-remarks">Reasons</Label>
              <Textarea
                id="reject-remarks"
                rows={4}
                placeholder="e.g. Proposal penetrates the approach surface by 12.4 m…"
                aria-invalid={!!rejectForm.formState.errors.remarks}
                {...rejectForm.register("remarks")}
              />
              {rejectForm.formState.errors.remarks && (
                <p className="text-xs text-destructive" role="alert">
                  {rejectForm.formState.errors.remarks.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(null)} disabled={pending}>
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={pending || !rejectForm.formState.isValid}
              >
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Reject
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Approve */}
      <Dialog open={open === "approve"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <form
            onSubmit={approveForm.handleSubmit((values) =>
              runTransition("APPROVED", values.remarks || undefined, "Application approved")
            )}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Approve application</DialogTitle>
              <DialogDescription>
                Grant height clearance for {app.refNo}. The certificate is issued from the{" "}
                <span className="font-medium">{t("nav.certificates")}</span> module after approval.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="approve-remarks">
                {t("common.remarks")}{" "}
                <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Textarea
                id="approve-remarks"
                rows={3}
                placeholder="e.g. Approved with standard marking and lighting conditions…"
                {...approveForm.register("remarks")}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(null)} disabled={pending}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Approve
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Escalate */}
      <Dialog open={open === "escalate"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <form
            onSubmit={escalateForm.handleSubmit((values) => escalate.mutate(values))}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Escalate case</DialogTitle>
              <DialogDescription>
                Records an internal escalation note on the timeline, visible to CAAB officers only.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="escalate-note">{t("application.internalNotes")}</Label>
              <Textarea
                id="escalate-note"
                rows={4}
                placeholder="Why does this case need attention?"
                aria-invalid={!!escalateForm.formState.errors.remarks}
                {...escalateForm.register("remarks")}
              />
              {escalateForm.formState.errors.remarks && (
                <p className="text-xs text-destructive" role="alert">
                  {escalateForm.formState.errors.remarks.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(null)}
                disabled={escalate.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={escalate.isPending || !escalateForm.formState.isValid}>
                {escalate.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Escalate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
