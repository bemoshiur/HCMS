"use client";

/**
 * Dashboard charts (Recharts) — thin marks, rounded data-ends, recessive
 * grid/axes, text in text tokens (never the series colour), 2px surface gaps
 * between donut segments, minimal tooltips, legends for multi-series only.
 */
import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

// ─────────────────────────── Shared pieces ───────────────────────────

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 } as const;

type TooltipRow = { name: string; value: number | string; color?: string };

function TooltipCard({ title, rows }: { title?: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      {title && <p className="mb-1 font-medium text-foreground">{title}</p>}
      <div className="space-y-0.5">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center gap-2">
            {row.color && (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: row.color }}
                aria-hidden
              />
            )}
            <span className="text-muted-foreground">{row.name}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums text-foreground">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Loose typing — recharts injects these props into `content`.
type RTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: { name?: string; value?: number; color?: string; fill?: string; payload?: Record<string, unknown> }[];
};

function SeriesTooltip({ active, label, payload }: RTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <TooltipCard
      title={label != null ? String(label) : undefined}
      rows={payload.map((p) => ({
        name: p.name ?? "",
        value: (p.value ?? 0).toLocaleString("en-US"),
        color: p.color ?? p.fill,
      }))}
    />
  );
}

function ChartLegend({ items }: { items: { name: string; color: string; value?: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <span key={item.name} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
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
      No data yet
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

// ─────────────────────── Monthly submitted vs decided ───────────────────────

export function MonthlyThroughputChart({
  data,
}: {
  data: { month: string; submitted: number; decided: number }[];
}) {
  if (!data.length) return <NoChartData />;
  return (
    <div role="img" aria-label="Monthly submitted versus decided applications">
      <ResponsiveContainer width="100%" height={256}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barGap={2}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            content={<SeriesTooltip />}
            cursor={{ fill: "var(--muted)", fillOpacity: 0.45 }}
          />
          <Bar dataKey="submitted" name="Submitted" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="decided" name="Decided" fill="var(--chart-3)" radius={[3, 3, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend
        items={[
          { name: "Submitted", color: "var(--chart-1)" },
          { name: "Decided", color: "var(--chart-3)" },
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

export function OutcomesDonut({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <NoChartData />;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div role="img" aria-label="Application outcome mix">
      <div className="relative">
        <ResponsiveContainer width="100%" height={224}>
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

// ──────────────────────── Applications by airport ────────────────────────

export function ByAirportChart({ data }: { data: { icao: string; count: number }[] }) {
  if (!data.length) return <NoChartData />;
  return (
    <div role="img" aria-label="Applications by airport">
      <ResponsiveContainer width="100%" height={Math.max(256, data.length * 34)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 28, bottom: 0, left: -10 }}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="icao"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            content={<SeriesTooltip />}
            cursor={{ fill: "var(--muted)", fillOpacity: 0.45 }}
          />
          <Bar
            dataKey="count"
            name="Applications"
            fill="var(--chart-1)"
            radius={[0, 3, 3, 0]}
            maxBarSize={14}
            label={{ position: "right", fill: "var(--muted-foreground)", fontSize: 11 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────── Applications by structure type ───────────────────────

export function ByStructureTypeChart({ data }: { data: { type: string; count: number }[] }) {
  if (!data.length) return <NoChartData />;
  return (
    <div role="img" aria-label="Applications by structure type">
      <ResponsiveContainer width="100%" height={256}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="type"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            interval={0}
            tickFormatter={(v: string) => (v.length > 11 ? `${v.slice(0, 10)}…` : v)}
          />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            content={<SeriesTooltip />}
            cursor={{ fill: "var(--muted)", fillOpacity: 0.45 }}
          />
          <Bar
            dataKey="count"
            name="Applications"
            fill="var(--chart-1)"
            radius={[3, 3, 0, 0]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
