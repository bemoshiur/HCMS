"use client";

// Workflow stepper driven by WORKFLOW_STEPS; terminal REJECTED/REVOKED/EXPIRED
// render distinctly (red/grey). STUDY and RETURNED_FOR_INFO show as amber
// annotations on their host step.
import * as React from "react";
import type { ApplicationStatus } from "@prisma/client";
import { Check, X, Clock, RotateCcw, FlaskConical } from "lucide-react";
import { motion } from "framer-motion";
import { WORKFLOW_STEPS } from "@/lib/workflow";
import { useT } from "@/components/providers";
import { cn } from "@/lib/utils";

type StepState = "completed" | "current" | "upcoming" | "failed" | "lapsed";

/** Index of the step the given status maps onto. */
const STEP_INDEX: Partial<Record<ApplicationStatus, number>> = {
  DRAFT: -1,
  SUBMITTED: 0,
  RETURNED_FOR_INFO: 0,
  ENDORSED: 1,
  INTAKE_SCRUTINY: 2,
  UNDER_REVIEW: 3,
  STUDY: 3,
  DECISION_PENDING: 4,
  APPROVED: 4,
  REJECTED: 4,
  CERTIFICATE_ISSUED: 5,
  REVALIDATION: 5,
  EXPIRED: 5,
  REVOKED: 5,
};

export function WorkflowStepper({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  const t = useT();
  const index = STEP_INDEX[status] ?? 0;
  const isRejected = status === "REJECTED";
  const isRevoked = status === "REVOKED";
  const isExpired = status === "EXPIRED";
  const isApproved = status === "APPROVED";
  const isIssued = status === "CERTIFICATE_ISSUED";
  const isStudy = status === "STUDY";
  const isReturned = status === "RETURNED_FOR_INFO";
  const isRevalidation = status === "REVALIDATION";

  function stateFor(i: number): StepState {
    if (i < index) return "completed";
    if (i > index) return "upcoming";
    // i === index
    if (isRejected || isRevoked) return "failed";
    if (isExpired) return "lapsed";
    if (isApproved) return "completed"; // decision made, certificate pending
    if (isIssued) return "completed";
    return "current";
  }

  return (
    <div className={cn("rounded-lg border bg-card px-4 py-4", className)}>
      <ol className="flex items-start gap-0 overflow-x-auto pb-1" aria-label="Workflow progress">
        {WORKFLOW_STEPS.map((step, i) => {
          const state = stateFor(i);
          const isLast = i === WORKFLOW_STEPS.length - 1;
          const label = step.label;
          return (
            <li key={step.status} className={cn("flex min-w-[92px] flex-1 items-start", !isLast && "")}>
              <div className="flex w-full flex-col items-center text-center">
                <div className="flex w-full items-center">
                  <div
                    className={cn(
                      "h-0.5 flex-1 rounded transition-colors",
                      i === 0 ? "bg-transparent" : state === "upcoming" ? "bg-border" : "bg-primary/60",
                      (state === "failed" || state === "lapsed") && i !== 0 && "bg-primary/60"
                    )}
                    aria-hidden
                  />
                  <motion.span
                    initial={false}
                    animate={state === "current" ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                    transition={
                      state === "current"
                        ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                        : { duration: 0.2 }
                    }
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                      state === "completed" &&
                        "border-primary bg-primary text-primary-foreground",
                      state === "current" &&
                        "border-primary bg-background text-primary ring-4 ring-primary/15",
                      state === "upcoming" &&
                        "border-border bg-muted text-muted-foreground",
                      state === "failed" &&
                        "border-destructive bg-destructive text-white",
                      state === "lapsed" && "border-border bg-muted-foreground/20 text-muted-foreground"
                    )}
                    aria-hidden
                  >
                    {state === "completed" ? (
                      <Check className="size-3.5" />
                    ) : state === "failed" ? (
                      <X className="size-3.5" />
                    ) : state === "lapsed" ? (
                      <Clock className="size-3.5" />
                    ) : (
                      i + 1
                    )}
                  </motion.span>
                  <div
                    className={cn(
                      "h-0.5 flex-1 rounded transition-colors",
                      isLast ? "bg-transparent" : state === "completed" ? "bg-primary/60" : "bg-border"
                    )}
                    aria-hidden
                  />
                </div>
                <span
                  className={cn(
                    "mt-1.5 text-[11px] font-medium leading-tight",
                    state === "current" && "text-primary",
                    state === "completed" && "text-foreground",
                    state === "upcoming" && "text-muted-foreground",
                    state === "failed" && "text-destructive",
                    state === "lapsed" && "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
                {/* Step annotations */}
                {i === index && isStudy && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                    <FlaskConical className="size-2.5" aria-hidden />
                    {t("status.STUDY")}
                  </span>
                )}
                {i === index && isReturned && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                    <RotateCcw className="size-2.5" aria-hidden />
                    {t("status.RETURNED_FOR_INFO")}
                  </span>
                )}
                {i === index && (isRejected || isRevoked) && (
                  <span className="mt-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                    {t(`status.${status}`)}
                  </span>
                )}
                {i === index && (isExpired || isRevalidation) && (
                  <span className="mt-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {t(`status.${status}`)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
