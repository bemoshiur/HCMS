"use client";

// Small animated stepper for the new-application wizard.
// Completed steps get a check + filled dot; the current step pulses gently.
import * as React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStep {
  label: string;
  description?: string;
}

export function WizardStepper({
  steps,
  current,
  onStepClick,
  className,
}: {
  steps: WizardStep[];
  current: number;
  /** Allows jumping back to a previously completed step. */
  onStepClick?: (index: number) => void;
  className?: string;
}) {
  return (
    <nav aria-label="Application steps" className={cn("rounded-lg border bg-card px-4 py-3", className)}>
      <ol className="flex items-start overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const clickable = done && !!onStepClick;
          const isLast = i === steps.length - 1;
          return (
            <li key={step.label} className="flex min-w-[84px] flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <span
                  className={cn(
                    "h-0.5 flex-1 rounded transition-colors duration-300",
                    i === 0 ? "bg-transparent" : done || active ? "bg-primary/60" : "bg-border"
                  )}
                  aria-hidden
                />
                <motion.button
                  type="button"
                  disabled={!clickable}
                  onClick={clickable ? () => onStepClick?.(i) : undefined}
                  aria-current={active ? "step" : undefined}
                  aria-label={`Step ${i + 1}: ${step.label}${done ? " (completed)" : active ? " (current)" : ""}`}
                  initial={false}
                  animate={active ? { scale: [1, 1.07, 1] } : { scale: 1 }}
                  transition={
                    active
                      ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.2 }
                  }
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors focus-visible:outline-2",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary bg-background text-primary ring-4 ring-primary/15",
                    !done && !active && "border-border bg-muted text-muted-foreground",
                    clickable && "cursor-pointer hover:opacity-85"
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden /> : i + 1}
                </motion.button>
                <span
                  className={cn(
                    "h-0.5 flex-1 rounded transition-colors duration-300",
                    isLast ? "bg-transparent" : done ? "bg-primary/60" : "bg-border"
                  )}
                  aria-hidden
                />
              </div>
              <span
                className={cn(
                  "mt-1.5 px-1 text-[11px] font-medium leading-tight",
                  active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
              {step.description && (
                <span className="hidden text-[10px] text-muted-foreground lg:block">
                  {step.description}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
