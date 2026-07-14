"use client";

// Manual status determination for an obstacle (RadioGroup + remarks → PATCH).
// Remarks are mandatory when escalating to ILLEGAL (enforcement record).
import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StatusBadge } from "@/components/shared/status-badge";
import { useT } from "@/components/providers";
import {
  fetchJson,
  OBSTACLE_STATUSES,
  type ObstacleRow,
  type ObstacleStatus,
} from "./types";

const STATUS_HINTS: Record<ObstacleStatus, string> = {
  COMPLIANT: "Verified below the permissible top elevation.",
  PENETRATING: "Confirmed to penetrate the protective surfaces.",
  UNDER_MONITORING: "Reported or uncertain — keep under observation.",
  ILLEGAL: "Unauthorised penetration — enforcement action pending.",
};

const schema = z
  .object({
    status: z.enum(["COMPLIANT", "PENETRATING", "UNDER_MONITORING", "ILLEGAL"]),
    remarks: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.status !== "ILLEGAL" || (v.remarks ?? "").length >= 5, {
    message: "State the enforcement grounds (at least 5 characters)",
    path: ["remarks"],
  });

type FormValues = z.infer<typeof schema>;

export function SetStatusDialog({
  obstacle,
  onOpenChange,
}: {
  obstacle: ObstacleRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { status: "UNDER_MONITORING", remarks: "" },
  });

  // Re-seed the form each time a different obstacle opens the dialog.
  React.useEffect(() => {
    if (obstacle) {
      form.reset({ status: obstacle.status, remarks: obstacle.remarks ?? "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obstacle?.id]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      fetchJson<{ obstacle: ObstacleRow }>(`/api/obstacles/${obstacle!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: values.status,
          remarks: values.remarks?.trim() || null,
        }),
      }),
    onSuccess: (data) => {
      toast.success(
        `Status updated — ${data.obstacle.name ?? data.obstacle.structureType}`,
        { description: STATUS_HINTS[data.obstacle.status] }
      );
      queryClient.invalidateQueries({ queryKey: ["obstacles"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(t("common.error"), { description: error.message });
    },
  });

  const selected = form.watch("status");

  return (
    <Dialog
      open={obstacle !== null}
      onOpenChange={(open) => !mutation.isPending && onOpenChange(open)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-primary" aria-hidden />
            Set obstacle status
          </DialogTitle>
          <DialogDescription>
            Record a manual compliance determination for this structure. The change is
            written to the audit trail.
          </DialogDescription>
        </DialogHeader>

        {obstacle && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-0.5">
            <p className="font-medium">{obstacle.name ?? obstacle.structureType}</p>
            <p className="text-muted-foreground">
              {obstacle.structureType} · {obstacle.airport.icao} — {obstacle.airport.name}
            </p>
            <div className="pt-1">
              <StatusBadge status={obstacle.status} />
            </div>
          </div>
        )}

        <form
          id="obstacle-status-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                aria-label={t("common.status")}
                className="gap-2"
              >
                {OBSTACLE_STATUSES.map((status) => (
                  <Label
                    key={status}
                    htmlFor={`obstacle-status-${status}`}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent/60"
                  >
                    <RadioGroupItem
                      id={`obstacle-status-${status}`}
                      value={status}
                      className="mt-0.5"
                    />
                    <span className="grid gap-0.5 font-normal">
                      <span className="text-sm font-medium">{t(`status.${status}`)}</span>
                      <span className="text-xs text-muted-foreground">
                        {STATUS_HINTS[status]}
                      </span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            )}
          />

          <div className="space-y-2">
            <Label htmlFor="obstacle-status-remarks">
              {t("common.remarks")}
              {selected !== "ILLEGAL" && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  ({t("common.optional")})
                </span>
              )}
            </Label>
            <Textarea
              id="obstacle-status-remarks"
              rows={3}
              placeholder={
                selected === "ILLEGAL"
                  ? "State the enforcement grounds…"
                  : "Add remarks for the register…"
              }
              aria-invalid={!!form.formState.errors.remarks}
              {...form.register("remarks")}
            />
            {form.formState.errors.remarks && (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.remarks.message}
              </p>
            )}
          </div>
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
            form="obstacle-status-form"
            variant={selected === "ILLEGAL" ? "destructive" : "default"}
            disabled={!form.formState.isValid || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {mutation.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
