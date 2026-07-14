"use client";

// Empty state: icon, message, primary action (§4).
import * as React from "react";
import { type LucideIcon, Inbox } from "lucide-react";
import { FadeIn } from "@/components/motion";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <FadeIn
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card px-6 py-14 text-center",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" aria-hidden />
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {action}
    </FadeIn>
  );
}
