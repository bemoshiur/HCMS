"use client";

// The verdict form — CONFIRM / OVERRIDE (value + remarks) / REFER_STUDY
// (remarks). RHF + Zod, disabled until valid, redirects to /review on success.
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, FlaskConical, Gavel, Loader2, PenLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapse } from "@/components/motion";
import { useT } from "@/components/providers";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/app/(app)/applications/_components/api";
import type { ReviewConsoleResponse } from "../../_components/types";

const schema = z
  .object({
    verdict: z.enum(["CONFIRM", "OVERRIDE", "REFER_STUDY"], {
      error: "Select a verdict",
    }),
    overrideValueAmslM: z.string().trim().optional(),
    remarks: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.verdict === "OVERRIDE") {
      const n = Number(data.overrideValueAmslM);
      if (!data.overrideValueAmslM || !Number.isFinite(n) || n <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["overrideValueAmslM"],
          message: "Enter the limiting value in metres AMSL",
        });
      }
      if (!data.remarks) {
        ctx.addIssue({
          code: "custom",
          path: ["remarks"],
          message: "Remarks are required when overriding",
        });
      }
    }
    if (data.verdict === "REFER_STUDY" && !data.remarks) {
      ctx.addIssue({
        code: "custom",
        path: ["remarks"],
        message: "Remarks are required when referring to study",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const OPTIONS: Array<{
  value: FormValues["verdict"];
  icon: typeof CheckCircle2;
  title: string;
  description: string;
}> = [
  {
    value: "CONFIRM",
    icon: CheckCircle2,
    title: "Confirm automatic assessment",
    description: "Adopt the engine result as your discipline's verdict. Remarks optional.",
  },
  {
    value: "OVERRIDE",
    icon: PenLine,
    title: "Override with reasons",
    description:
      "Set your discipline's limiting value (m AMSL) — it replaces the automatic limit for this discipline. Value and remarks required.",
  },
  {
    value: "REFER_STUDY",
    icon: FlaskConical,
    title: "Refer to aeronautical study",
    description:
      "Send the case to the study team for aeronautical / shielding assessment. Remarks required.",
  },
];

export function VerdictForm({ detail }: { detail: ReviewConsoleResponse }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { review } = detail;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { overrideValueAmslM: "", remarks: "" },
    mode: "onChange",
  });
  const verdict = form.watch("verdict");

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      fetchJson<{ applicationStatus: string }>(`/api/reviews/${review.id}/decide`, {
        method: "POST",
        body: JSON.stringify({
          verdict: values.verdict,
          overrideValueAmslM:
            values.verdict === "OVERRIDE" ? Number(values.overrideValueAmslM) : undefined,
          remarks: values.remarks || undefined,
        }),
      }),
    onSuccess: ({ applicationStatus }) => {
      const followUp =
        applicationStatus === "STUDY"
          ? "Case referred to aeronautical study."
          : applicationStatus === "DECISION_PENDING"
            ? "All disciplines decided — case moved to Decision Pending."
            : "Waiting on the remaining discipline reviews.";
      toast.success(`${review.discipline} verdict recorded`, { description: followUp });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["review", review.id] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      router.push("/review");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  const remarksRequired = verdict === "OVERRIDE" || verdict === "REFER_STUDY";

  return (
    <Card className="p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Gavel className="size-4 text-primary" aria-hidden />
        Your {review.discipline} verdict
      </h3>

      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="mt-3 space-y-4"
        aria-label={`${review.discipline} verdict form`}
      >
        <Controller
          control={form.control}
          name="verdict"
          render={({ field }) => (
            <RadioGroup
              value={field.value ?? ""}
              onValueChange={(v) => {
                field.onChange(v);
                // revalidate conditional fields on branch change
                void form.trigger();
              }}
              className="gap-2"
              aria-label="Verdict"
            >
              {OPTIONS.map((option) => {
                const selected = field.value === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      selected ? "border-primary bg-primary/5" : "hover:bg-accent/50"
                    )}
                  >
                    <RadioGroupItem value={option.value} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <option.icon
                          className={cn(
                            "size-4",
                            option.value === "CONFIRM" && "text-success",
                            option.value === "OVERRIDE" && "text-warning",
                            option.value === "REFER_STUDY" && "text-info"
                          )}
                          aria-hidden
                        />
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
          )}
        />
        {form.formState.errors.verdict && (
          <p className="text-sm text-destructive" role="alert">
            {form.formState.errors.verdict.message}
          </p>
        )}

        <Collapse open={verdict === "OVERRIDE"}>
          <div className="space-y-1.5 pb-1">
            <Label htmlFor="override-value">
              Discipline limiting value (m AMSL) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="override-value"
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              placeholder="e.g. 62.5"
              aria-invalid={!!form.formState.errors.overrideValueAmslM}
              {...form.register("overrideValueAmslM")}
            />
            <p className="text-xs text-muted-foreground">
              Sets the {review.discipline} discipline&apos;s permissible top elevation for this
              case, replacing the automatic value.
            </p>
            {form.formState.errors.overrideValueAmslM && (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.overrideValueAmslM.message}
              </p>
            )}
          </div>
        </Collapse>

        <div className="space-y-1.5">
          <Label htmlFor="verdict-remarks">
            {t("common.remarks")}{" "}
            {remarksRequired ? (
              <span className="text-destructive">*</span>
            ) : (
              <span className="text-muted-foreground">({t("common.optional")})</span>
            )}
          </Label>
          <Textarea
            id="verdict-remarks"
            rows={4}
            placeholder={
              verdict === "REFER_STUDY"
                ? "Why does this case need an aeronautical study?"
                : verdict === "OVERRIDE"
                  ? "Justify the override — reference the relevant criteria."
                  : "Optional notes for the case record…"
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

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/review")}
            disabled={mutation.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!form.formState.isValid || mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {mutation.isPending ? t("common.submitting") : "Record verdict"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
