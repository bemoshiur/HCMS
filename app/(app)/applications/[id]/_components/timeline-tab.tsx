"use client";

// Case timeline: staggered vertical event list (internal events marked and
// CAAB-only) plus a message composer with an internal-note toggle.
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpRight,
  BadgeCheck,
  Calculator,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  FileClock,
  FlaskConical,
  Loader2,
  Lock,
  MessageSquare,
  RotateCcw,
  Send,
  StickyNote,
  UserCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { Stagger, StaggerItem } from "@/components/motion";
import { useT } from "@/components/providers";
import { formatDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fetchJson } from "../../_components/api";
import type { CaseEventDto, DetailResponse } from "../../_components/types";

const messageSchema = z.object({
  note: z.string().trim().min(2, "Message is too short").max(2000),
  internal: z.boolean(),
});
type MessageForm = z.infer<typeof messageSchema>;

interface EventMeta {
  icon: LucideIcon;
  label: string;
  tone: "default" | "success" | "danger" | "warning" | "info";
}

function eventMeta(type: string, t: (k: string) => string): EventMeta {
  // Status-change events use the status label
  const statusLabel = t(`status.${type}`);
  if (statusLabel !== `status.${type}`) {
    const tone =
      type === "APPROVED" || type === "CERTIFICATE_ISSUED"
        ? "success"
        : type === "REJECTED" || type === "REVOKED"
          ? "danger"
          : type === "RETURNED_FOR_INFO" || type === "STUDY"
            ? "warning"
            : "info";
    const icon =
      type === "APPROVED" || type === "CERTIFICATE_ISSUED"
        ? BadgeCheck
        : type === "REJECTED" || type === "REVOKED"
          ? XCircle
          : type === "RETURNED_FOR_INFO"
            ? RotateCcw
            : type === "STUDY"
              ? FlaskConical
              : CircleDot;
    return { icon, label: statusLabel, tone };
  }
  switch (type) {
    case "CREATED":
      return { icon: FileClock, label: "Created", tone: "default" };
    case "MESSAGE":
      return { icon: MessageSquare, label: "Message", tone: "info" };
    case "NOTE":
      return { icon: StickyNote, label: "Internal note", tone: "default" };
    case "ESCALATED":
      return { icon: ArrowUpRight, label: "Escalated", tone: "warning" };
    case "ASSIGNED":
      return { icon: UserCheck, label: "Assigned", tone: "info" };
    case "EVALUATED":
      return { icon: Calculator, label: "Evaluation", tone: "info" };
    case "INTAKE":
      return { icon: ClipboardCheck, label: "Intake", tone: "info" };
    case "RETURNED":
      return { icon: RotateCcw, label: "Returned", tone: "warning" };
    case "STUDY_REFERRED":
      return { icon: FlaskConical, label: "Referred to study", tone: "warning" };
    case "REVIEW_COMPLETE":
      return { icon: CheckCircle2, label: "Reviews complete", tone: "success" };
    case "DECISION":
      return { icon: BadgeCheck, label: "Decision", tone: "success" };
    default:
      return {
        icon: CircleDot,
        label: type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " "),
        tone: "default",
      };
  }
}

const TONE_RING: Record<EventMeta["tone"], string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
};

export function TimelineTab({ detail }: { detail: DetailResponse }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { application: app, viewer } = detail;
  const events: CaseEventDto[] = app.caseEvents;

  const form = useForm<MessageForm>({
    resolver: zodResolver(messageSchema),
    mode: "onChange",
    defaultValues: { note: "", internal: false },
  });

  const send = useMutation({
    mutationFn: (values: MessageForm) =>
      fetchJson(`/api/applications/${app.id}/message`, {
        method: "POST",
        body: JSON.stringify({ note: values.note, internal: values.internal && viewer.isCaab }),
      }),
    onSuccess: (_, values) => {
      toast.success(values.internal ? "Internal note added" : "Message sent to the applicant");
      form.reset({ note: "", internal: values.internal });
      queryClient.invalidateQueries({ queryKey: ["application", app.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  const internal = form.watch("internal");

  return (
    <div className="space-y-4">
      {/* Composer */}
      <Card className="p-4">
        <form onSubmit={form.handleSubmit((v) => send.mutate(v))} className="space-y-3">
          <Label htmlFor="case-message" className="text-sm font-semibold">
            {internal ? t("application.internalNotes") : t("application.messages")}
          </Label>
          <Textarea
            id="case-message"
            rows={3}
            placeholder={
              internal
                ? "Add an internal note (visible to CAAB officers only)…"
                : "Write a message to the applicant…"
            }
            aria-invalid={!!form.formState.errors.note}
            {...form.register("note")}
          />
          {form.formState.errors.note && form.formState.dirtyFields.note && (
            <p className="text-xs text-destructive" role="alert">
              {form.formState.errors.note.message}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {viewer.isCaab ? (
              <div className="flex items-center gap-1.5">
                <Switch
                  id="internal-toggle"
                  checked={internal}
                  onCheckedChange={(v) => form.setValue("internal", v, { shouldValidate: true })}
                />
                <Label htmlFor="internal-toggle" className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3" aria-hidden />
                  Internal note (CAAB only)
                </Label>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                Messages are visible on the case timeline.
              </span>
            )}
            <Button type="submit" size="sm" disabled={send.isPending || !form.formState.isValid}>
              {send.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              {send.isPending ? t("common.submitting") : "Post"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Timeline */}
      {events.length === 0 ? (
        <EmptyState icon={FileClock} title="No events yet" description="Case activity will appear here." />
      ) : (
        <Stagger className="relative space-y-0 pl-1">
          {events.map((event, i) => {
            const meta = eventMeta(event.type, t);
            const Icon = meta.icon;
            const isLast = i === events.length - 1;
            return (
              <StaggerItem key={event.id} className="relative flex gap-3 pb-6">
                {!isLast && (
                  <span
                    className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-border"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
                    TONE_RING[meta.tone]
                  )}
                  aria-hidden
                >
                  <Icon className="size-4" />
                </span>
                <div
                  className={cn(
                    "min-w-0 flex-1 rounded-lg border bg-card px-3.5 py-2.5",
                    event.internal && "border-dashed bg-muted/40"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold">{meta.label}</span>
                    {event.internal && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        <Lock className="size-2.5" aria-hidden />
                        Internal
                      </span>
                    )}
                    <span
                      className="ml-auto whitespace-nowrap text-xs text-muted-foreground"
                      title={formatDateTime(event.at)}
                    >
                      {timeAgo(event.at)}
                    </span>
                  </div>
                  {event.note && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{event.note}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.actor
                      ? `${event.actor.name} · ${t(`roles.${event.actor.role}`)}`
                      : "System"}
                    {" · "}
                    {formatDateTime(event.at)}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
