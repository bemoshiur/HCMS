"use client";

/**
 * Reports analytics charts (Recharts) — thin marks, recessive grid/axes,
 * status palette (green cleared / red objections / amber pending), minimal
 * custom tooltips, legends only for multi-series charts.
 */
import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonSwap } from "@/components/motion";
import { cn } from "@/lib/utils";
import type { AnalyticsResponse } from "./types";

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 } as const;

// ─────────────────────────── Tooltip / legend ───────────────────────────

type RTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: {
    name?: string;
    value?: number;
    color?: string;
    fill?: string;
    stroke?: string;
  }[];
};

function SeriesTooltip({ active, label, payload }: RTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      {label != null && <p className="mb-1 font-medium text-foreground">{String(label)}</p>}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={`${p.name}-${i}`} className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: p.color ?? p.stroke ?? p.fill }}
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

function ChartLegend({ items }: { items: { name: string; color: string; value?: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <span
          key={item.name}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span className="size-2 rounded-full" style={{ background: item.color }} aria-hidden />
          {item.name}
          {item.value != null && (
            <span className="font-medium tabular-nums text-foreground">{item.value}</span>
          )}
        </span>
      ))}
    </div>
  );
}

function NoChartData() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      No data for this filter
    </div>
  );
}

/** Card wrapper with title + skeleton crossfade while loading. */
export function ChartCard({
  title,
  loading,
  children,
  className,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-3 py-4", className)}>
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <SkeletonSwap
          loading={loading}
          skeleton={
            <div className="space-y-3">
              <Skeleton className="h-56 w-full" />
              <Skeleton className="mx-auto h-3 w-40" />
            </div>
          }
        >
          {children}
        </SkeletonSwap>
      </CardContent>
    </Card>
  );
}

// ─────────────── 12-month throughput: bars + issued line ───────────────

export function ThroughputChart({ data }: { data: AnalyticsResponse["throughput"] }) {
  if (!data.length) return <NoChartData />;
  return (
    <div role="img" aria-label="Monthly submitted, decided and certificates issued">
      <ResponsiveContainer width="100%" height={264}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barGap={2}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            content={<SeriesTooltip />}
            cursor={{ fill: "var(--muted)", fillOpacity: 0.45 }}
          />
          <Bar
            dataKey="submitted"
            name="Submitted"
            fill="var(--chart-1)"
            radius={[3, 3, 0, 0]}
            maxBarSize={14}
          />
          <Bar
            dataKey="decided"
            name="Decided"
            fill="var(--chart-3)"
            radius={[3, 3, 0, 0]}
            maxBarSize={14}
          />
          <Line
            type="monotone"
            dataKey="issued"
            name="Certificates issued"
            stroke="var(--chart-4)"
            strokeWidth={2}
            dot={{ r: 2.5, strokeWidth: 0, fill: "var(--chart-4)" }}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <ChartLegend
        items={[
          { name: "Submitted", color: "var(--chart-1)" },
          { name: "Decided", color: "var(--chart-3)" },
          { name: "Certificates issued", color: "var(--chart-4)" },
        ]}
      />
    </div>
  );
}

// ───────────────────────────── Outcomes donut ─────────────────────────────

const OUTCOME_COLORS: Record<string, string> = {
  Cleared: "var(--success)",
  Objection: "var(--destructive)",
  "Under study": "var(--warning)",
  "In progress": "var(--info)",
};

export function OutcomesDonut({ data }: { data: AnalyticsResponse["outcomes"] }) {
  if (!data.length) return <NoChartData />;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div role="img" aria-label="Application outcome mix">
      <div className="relative">
        <ResponsiveContainer width="100%" height={232}>
          <PieChart>
            <Tooltip content={<SeriesTooltip />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={OUTCOME_COLORS[entry.name] ?? "var(--chart-2)"} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {total.toLocaleString("en-US")}
          </span>
          <span className="text-xs text-muted-foreground">cases</span>
        </div>
      </div>
      <ChartLegend
        items={data.map((d) => ({
          name: d.name,
          color: OUTCOME_COLORS[d.name] ?? "var(--chart-2)",
          value: d.value.toLocaleString("en-US"),
        }))}
      />
    </div>
  );
}

// ─────────────── Per-airport stacked: cleared vs objections ───────────────

export function ByAirportChart({ data }: { data: AnalyticsResponse["byAirport"] }) {
  if (!data.length) return <NoChartData />;
  const rows = data.map((d) => ({
    icao: d.icao,
    cleared: d.cleared,
    objections: d.objections,
    other: Math.max(0, d.total - d.cleared - d.objections),
  }));
  return (
    <div role="img" aria-label="Cleared versus objections by airport">
      <ResponsiveContainer width="100%" height={264}>
        <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="icao" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            content={<SeriesTooltip />}
            cursor={{ fill: "var(--muted)", fillOpacity: 0.45 }}
          />
          <Bar dataKey="cleared" name="Cleared" stackId="a" fill="var(--success)" maxBarSize={26} />
          <Bar
            dataKey="objections"
            name="Objections"
            stackId="a"
            fill="var(--destructive)"
            maxBarSize={26}
          />
          <Bar
            dataKey="other"
            name="In pipeline"
            stackId="a"
            fill="var(--muted-foreground)"
            fillOpacity={0.35}
            radius={[3, 3, 0, 0]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend
        items={[
          { name: "Cleared", color: "var(--success)" },
          { name: "Objections", color: "var(--destructive)" },
          { name: "In pipeline", color: "color-mix(in srgb, var(--muted-foreground) 35%, transparent)" },
        ]}
      />
    </div>
  );
}

// ─────────────── Structure-type mix: count bars + avg height line ───────────────

export function ByStructureTypeChart({ data }: { data: AnalyticsResponse["byStructureType"] }) {
  if (!data.length) return <NoChartData />;
  return (
    <div role="img" aria-label="Applications by structure type with average requested height">
      <ResponsiveContainer width="100%" height={264}>
        <ComposedChart data={data} margin={{ top: 4, right: -8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="type"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            interval={0}
            tickFormatter={(v: string) => (v.length > 10 ? `${v.slice(0, 9)}…` : v)}
          />
          <YAxis
            yAxisId="count"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="height"
            orientation="right"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            unit=" m"
          />
          <Tooltip
            content={<SeriesTooltip />}
            cursor={{ fill: "var(--muted)", fillOpacity: 0.45 }}
          />
          <Bar
            yAxisId="count"
            dataKey="count"
            name="Applications"
            fill="var(--chart-1)"
            radius={[3, 3, 0, 0]}
            maxBarSize={24}
          />
          <Line
            yAxisId="height"
            type="monotone"
            dataKey="avgHeight"
            name="Avg height (m AGL)"
            stroke="var(--chart-4)"
            strokeWidth={2}
            dot={{ r: 2.5, strokeWidth: 0, fill: "var(--chart-4)" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <ChartLegend
        items={[
          { name: "Applications", color: "var(--chart-1)" },
          { name: "Avg height (m AGL)", color: "var(--chart-4)" },
        ]}
      />
    </div>
  );
}

// ─────────────────────── Turnaround histogram ───────────────────────

export function TurnaroundHistogram({
  data,
}: {
  data: AnalyticsResponse["turnaround"]["buckets"];
}) {
  if (!data.some((d) => d.count > 0)) return <NoChartData />;
  return (
    <div role="img" aria-label="Turnaround time distribution in days">
      <ResponsiveContainer width="100%" height={264}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="range" tick={AXIS_TICK} tickLine={false} axisLine={false} unit="d" />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            content={<SeriesTooltip />}
            cursor={{ fill: "var(--muted)", fillOpacity: 0.45 }}
          />
          <Bar
            dataKey="count"
            name="Decided cases"
            fill="var(--chart-2)"
            radius={[3, 3, 0, 0]}
            maxBarSize={34}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
