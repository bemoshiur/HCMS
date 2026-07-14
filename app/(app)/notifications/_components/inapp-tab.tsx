"use client";

// In-app notification list: comfortable rows, unread tint, stagger enter,
// unread→read fade, optional multi-select bulk mark.
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { CheckCheck, CircleCheck, ListChecks, MailOpen, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Stagger, StaggerItem } from "@/components/motion";
import { useT } from "@/components/providers";
import { timeAgo } from "@/lib/format";
import { fetchJson } from "@/app/(app)/applications/_components/api";
import { cn } from "@/lib/utils";
import { eventMeta, TONE_CHIP } from "./event-meta";
import type { InAppNotification, InAppResponse } from "./types";

type Filter = "all" | "unread";

export function InAppTab() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [filter, setFilter] = React.useState<Filter>("all");
  const [selectMode, setSelectMode] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<InAppResponse>({
    queryKey: ["notifications", "center"],
    queryFn: () => fetchJson<InAppResponse>("/api/notifications?limit=100"),
  });

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;
  const visible = React.useMemo(
    () => (filter === "unread" ? items.filter((n) => !n.read) : items),
    [items, filter]
  );

  const invalidate = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    [queryClient]
  );

  const markOne = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/notifications/${id}/read`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const markAll = useMutation({
    mutationFn: () => fetchJson("/api/notifications/read-all", { method: "POST" }),
    onSuccess: () => {
      invalidate();
      toast.success(t("common.markAllRead"));
    },
    onError: () => toast.error(t("common.error")),
  });

  const markBulk = useMutation({
    mutationFn: (vars: { ids: string[]; read: boolean }) =>
      fetchJson("/api/notifications/mark", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: (_res, vars) => {
      invalidate();
      toast.success(
        vars.read
          ? `${vars.ids.length} marked as read`
          : `${vars.ids.length} marked as unread`
      );
      exitSelectMode();
    },
    onError: () => toast.error(t("common.error")),
  });

  const exitSelectMode = React.useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRowActivate = (n: InAppNotification) => {
    if (selectMode) {
      toggleSelected(n.id);
      return;
    }
    if (!n.read) markOne.mutate(n.id);
    if (n.link) router.push(n.link);
  };

  const selectedIds = React.useMemo(() => [...selected], [selected]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium tabular-nums",
              unread > 0 ? "bg-info/10 text-info" : "bg-muted text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                unread > 0 ? "bg-info" : "bg-muted-foreground/50"
              )}
              aria-hidden
            />
            {unread} unread
          </span>

          {/* All / Unread segmented filter */}
          <div className="inline-flex items-center rounded-md border bg-muted/40 p-0.5" role="tablist" aria-label={t("common.filter")}>
            {(["all", "unread"] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2",
                  filter === key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {key === "all" ? t("common.all") : "Unread"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={selectMode ? "secondary" : "outline"}
            size="sm"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
          >
            {selectMode ? (
              <>
                <X className="size-3.5" aria-hidden /> {t("common.cancel")}
              </>
            ) : (
              <>
                <ListChecks className="size-3.5" aria-hidden /> Select
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAll.mutate()}
            disabled={unread === 0 || markAll.isPending}
          >
            <CheckCheck className="size-3.5" aria-hidden /> {t("common.markAllRead")}
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectMode && selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
            className="flex flex-wrap items-center gap-2 rounded-md border bg-accent/50 px-3 py-2"
          >
            <span className="text-xs font-medium text-accent-foreground">
              {selectedIds.length} {t("common.selected")}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => markBulk.mutate({ ids: selectedIds, read: true })}
                disabled={markBulk.isPending}
              >
                <MailOpen className="size-3.5" aria-hidden /> Mark read
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => markBulk.mutate({ ids: selectedIds, read: false })}
                disabled={markBulk.isPending}
              >
                <Mail className="size-3.5" aria-hidden /> Mark unread
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {visible.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title={filter === "unread" ? "All caught up" : "No notifications yet"}
          description={
            filter === "unread"
              ? "You have no unread notifications."
              : "Updates about your applications, reviews, and certificates will appear here."
          }
        />
      ) : (
        <Stagger className="space-y-2" stagger={0.035}>
          <AnimatePresence initial={false}>
            {visible.map((n) => {
              const meta = eventMeta(n.event);
              const Icon = meta.icon;
              const isSelected = selected.has(n.id);
              return (
                <StaggerItem
                  key={n.id}
                  layout
                  exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.18 } }}
                  onClick={() => handleRowActivate(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleRowActivate(n);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={n.title}
                  className={cn(
                    "group flex cursor-pointer items-start gap-3 overflow-hidden rounded-lg border bg-card p-4 transition-colors focus-visible:outline-2 hover:bg-accent/40",
                    !n.read && "border-info/20 bg-info/[0.04]",
                    isSelected && "ring-2 ring-info/40"
                  )}
                >
                    {selectMode && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelected(n.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${n.title}`}
                        className="mt-0.5"
                      />
                    )}

                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full",
                        TONE_CHIP[meta.tone]
                      )}
                    >
                      <Icon className="size-4.5" aria-hidden />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm leading-snug",
                            n.read ? "font-medium text-foreground" : "font-semibold text-foreground"
                          )}
                        >
                          {n.title}
                        </p>
                        <div className="flex shrink-0 items-center gap-2 pt-0.5">
                          <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                            {timeAgo(n.sentAt)}
                          </span>
                          <AnimatePresence>
                            {!n.read && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0, transition: { duration: 0.15 } }}
                                className="size-2 shrink-0 rounded-full bg-info"
                                aria-label="Unread"
                              />
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                        {meta.label}
                      </p>
                    </div>
                </StaggerItem>
              );
            })}
          </AnimatePresence>
        </Stagger>
      )}
    </div>
  );
}
