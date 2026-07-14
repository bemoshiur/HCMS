"use client";

// Monthly endorsed vs returned bar chart (Recharts) — thin bars, semantic
// status colours (green = endorsed, amber = returned), minimal tooltip.
import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonSwap } from "@/components/motion";
import type { MonthlyPoint } from "./api";

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 } as const;

// Loose typing — recharts injects these props into `content`.
type RTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: { name?: string; value?: number; color?: string; fill?: string }[];
};

function TrendTooltip({ active, label, payload }: RTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      {label != null && <p className="mb-1 font-medium text-foreground">{String(label)}</p>}
      <div className="space-y-0.5">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: p.color ?? p.fill }}
              aria-hidden
            />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums text-foreground">
              {(p.value ?? 0).toLocaleString("en-US")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EndorsementTrendCard({
  data,
  loading,
  className,
}: {
  data: MonthlyPoint[];
  loading: boolean;
  className?: string;
}) {
  const hasData = data.some((d) => d.endorsed > 0 || d.returned > 0);
  return (
    <Card className={className ? `gap-3 py-4 ${className}` : "gap-3 py-4"}>
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-medium">
          Endorsed vs returned — last 6 months
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <SkeletonSwap
          loading={loading}
          skeleton={
            <div className="space-y-3">
              <Skeleton className="h-44 w-full" />
              <Skeleton className="mx-auto h-3 w-36" />
            </div>
          }
        >
          {hasData ? (
            <div role="img" aria-label="Monthly endorsed versus returned applications">
              <ResponsiveContainer width="100%" height={176}>
                <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -22 }} barGap={2}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    content={<TrendTooltip />}
                    cursor={{ fill: "var(--muted)", fillOpacity: 0.45 }}
                  />
                  <Bar
                    dataKey="endorsed"
                    name="Endorsed"
                    fill="var(--success)"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={16}
                  />
                  <Bar
                    dataKey="returned"
                    name="Returned"
                    fill="var(--warning)"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={16}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: "var(--success)" }} aria-hidden />
                  Endorsed
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: "var(--warning)" }} aria-hidden />
                  Returned
                </span>
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              No endorsement activity yet
            </div>
          )}
        </SkeletonSwap>
      </CardContent>
    </Card>
  );
}
