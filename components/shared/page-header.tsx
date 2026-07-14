"use client";

// Every page: breadcrumb, title, primary actions top-right (§9).
import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { FadeIn } from "@/components/motion";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <FadeIn className={cn("mb-6", className)} y={4}>
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1 text-sm text-muted-foreground">
            {crumbs.map((crumb, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3.5 opacity-60" aria-hidden />}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-foreground transition-colors rounded-sm focus-visible:outline-2"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-foreground/80">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </FadeIn>
  );
}
