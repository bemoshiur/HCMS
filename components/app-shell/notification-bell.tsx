"use client";

// Notification bell with animated unread count and dropdown preview (§10).
import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/components/providers";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  sentAt: string;
}

export function NotificationBell() {
  const t = useT();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ items: NotificationItem[]; unread: number }>({
    queryKey: ["notifications", "bell"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=6");
      if (!res.ok) return { items: [], unread: 0 };
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const unread = data?.unread ?? 0;

  const markAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`${t("common.notifications")}${unread ? ` (${unread})` : ""}`} className="relative">
          <motion.span
            key={unread}
            initial={unread > 0 ? { rotate: [-8, 8, -4, 4, 0] } : false}
            transition={{ duration: 0.5 }}
          >
            <Bell className="size-5" aria-hidden />
          </motion.span>
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white tabular-nums"
              >
                {unread > 9 ? "9+" : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">{t("common.notifications")}</p>
          <Button variant="ghost" size="xs" onClick={markAllRead} disabled={unread === 0}>
            <CheckCheck className="size-3.5" aria-hidden /> {t("common.markAllRead")}
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !data?.items.length ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("common.noResults")}
            </p>
          ) : (
            data.items.map((n) => (
              <Link
                key={n.id}
                href={n.link ?? "/notifications"}
                className={cn(
                  "block border-b px-3 py-2.5 text-sm transition-colors last:border-0 hover:bg-accent",
                  !n.read && "bg-info/5"
                )}
              >
                <span className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-info" aria-hidden />}
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{n.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{n.body}</span>
                    <span className="block pt-0.5 text-[11px] text-muted-foreground/70">{timeAgo(n.sentAt)}</span>
                  </span>
                </span>
              </Link>
            ))
          )}
        </div>
        <div className="border-t p-1.5">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/notifications">{t("common.viewAll")}</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
