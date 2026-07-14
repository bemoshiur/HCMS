// GET /api/reports/analytics — deep analytics for the Reports module (§17).
// Read-only, role-scoped exactly like the applications list:
// APPLICANT → own org, AUTHORITY_OFFICER → own authority, CAAB roles → all.
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError, type SessionUser } from "@/lib/auth/guards";
import { ACTIVE_STATUSES } from "@/lib/workflow";
import type { ApplicationStatus, Prisma } from "@prisma/client";
import { format, startOfMonth, subMonths } from "date-fns";

export const dynamic = "force-dynamic";

// ─────────────────────────── Query parsing ───────────────────────────

const querySchema = z.object({
  icao: z.string().trim().max(4).optional(),
  from: z.string().trim().max(20).optional(), // ISO date yyyy-mm-dd
  to: z.string().trim().max(20).optional(),
});

function parseDate(value: string | undefined, endOfDay = false): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

/** Row scope by role — mirrors the applications list scoping. */
function scopeFor(user: SessionUser): Prisma.ApplicationWhereInput {
  if (user.role === "APPLICANT") return { applicantOrgId: user.orgId ?? "__none__" };
  if (user.role === "AUTHORITY_OFFICER") return { authorityOrgId: user.orgId ?? "__none__" };
  return {};
}

// ─────────────────────────── Aggregation helpers ───────────────────────────

const CLEARED: ApplicationStatus[] = ["APPROVED", "CERTIFICATE_ISSUED", "REVALIDATION"];
const OBJECTED: ApplicationStatus[] = ["REJECTED", "REVOKED"];
const IN_PROGRESS: ApplicationStatus[] = [
  "SUBMITTED",
  "ENDORSED",
  "INTAKE_SCRUTINY",
  "UNDER_REVIEW",
  "DECISION_PENDING",
  "RETURNED_FOR_INFO",
];
/** Statuses that imply the authority already endorsed (fallback when no event). */
const POST_ENDORSEMENT: ApplicationStatus[] = [
  "ENDORSED",
  "INTAKE_SCRUTINY",
  "UNDER_REVIEW",
  "STUDY",
  "DECISION_PENDING",
  "APPROVED",
  "REJECTED",
  "CERTIFICATE_ISSUED",
  "REVALIDATION",
  "EXPIRED",
  "REVOKED",
];

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Linear-interpolated percentile over a pre-sorted ascending array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

const TURNAROUND_BUCKETS: { range: string; min: number; max: number }[] = [
  { range: "0-7", min: 0, max: 7 },
  { range: "8-14", min: 8, max: 14 },
  { range: "15-21", min: 15, max: 21 },
  { range: "22-30", min: 22, max: 30 },
  { range: "31-60", min: 31, max: 60 },
  { range: "60+", min: 61, max: Infinity },
];

// ─────────────────────────────── Handler ───────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await requireCapability("report.view");

    const raw = Object.fromEntries(
      [...request.nextUrl.searchParams.entries()].filter(([, v]) => v !== "")
    );
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid query", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const query = parsed.data;

    const scope = scopeFor(user);
    const filters: Prisma.ApplicationWhereInput[] = [scope];
    if (query.icao) filters.push({ airport: { icao: query.icao.toUpperCase() } });
    const fromDate = parseDate(query.from);
    const toDate = parseDate(query.to, true);
    if (fromDate) filters.push({ submittedAt: { gte: fromDate } });
    if (toDate) filters.push({ submittedAt: { lte: toDate } });
    const where: Prisma.ApplicationWhereInput = { AND: filters };

    const now = new Date();
    const throughputStart = startOfMonth(subMonths(now, 11));

    const [
      statusGroups,
      submittedRows,
      decidedRows,
      issuedRows,
      airportStatusGroups,
      authorityRows,
      typeGroups,
      penetrationRows,
      activeWithSla,
      breached,
    ] = await Promise.all([
      // Outcome mix from a single status groupBy
      prisma.application.groupBy({ by: ["status"], _count: { _all: true }, where }),
      // Throughput: submissions in the last 12 calendar months
      prisma.application.findMany({
        where: { AND: [where, { submittedAt: { gte: throughputStart } }] },
        select: { submittedAt: true },
        take: 5000,
      }),
      // Decided cases — feeds throughput "decided" AND turnaround percentiles
      prisma.application.findMany({
        where: { AND: [where, { submittedAt: { not: null }, decidedAt: { not: null } }] },
        select: { submittedAt: true, decidedAt: true },
        orderBy: { decidedAt: "desc" },
        take: 2000,
      }),
      // Certificates issued per month (scoped through the application)
      prisma.certificate.findMany({
        where: { issuedAt: { gte: throughputStart }, application: where },
        select: { issuedAt: true },
        take: 5000,
      }),
      // Per-airport totals split by status (cleared / objections derived in JS)
      prisma.application.groupBy({
        by: ["airportId", "status"],
        _count: { _all: true },
        where,
      }),
      // Authority league — endorsement latency from the ENDORSED case event
      prisma.application.findMany({
        where: { AND: [where, { authorityOrgId: { not: null } }] },
        select: {
          status: true,
          submittedAt: true,
          authorityOrg: { select: { name: true } },
          caseEvents: {
            where: { type: "ENDORSED" },
            orderBy: { at: "asc" },
            take: 1,
            select: { at: true },
          },
        },
        take: 2000,
      }),
      // Structure-type mix with average requested height
      prisma.application.groupBy({
        by: ["structureType"],
        _count: { _all: true },
        _avg: { requestedHeightAglM: true },
        where,
        orderBy: { _count: { structureType: "desc" } },
        take: 12,
      }),
      // Penetrating evaluation results joined to their applications
      prisma.evaluationResult.findMany({
        where: { penetrationM: { gt: 0 }, application: where },
        orderBy: { computedAt: "desc" },
        take: 500,
        select: {
          penetrationM: true,
          applicationId: true,
          application: {
            select: {
              refNo: true,
              lat: true,
              lon: true,
              airport: { select: { icao: true } },
            },
          },
        },
      }),
      // SLA compliance over active cases
      prisma.application.count({
        where: { AND: [where, { status: { in: ACTIVE_STATUSES }, slaDueAt: { not: null } }] },
      }),
      prisma.application.count({
        where: { AND: [where, { status: { in: ACTIVE_STATUSES }, slaDueAt: { lt: now } }] },
      }),
    ]);

    // ── 12-month throughput (submitted / decided / issued) ──
    const monthKey = (d: Date) => format(d, "MMM yy");
    const throughput = Array.from({ length: 12 }, (_, i) => ({
      month: monthKey(startOfMonth(subMonths(now, 11 - i))),
      submitted: 0,
      decided: 0,
      issued: 0,
    }));
    const byMonth = new Map(throughput.map((m) => [m.month, m]));
    for (const r of submittedRows) {
      const bucket = r.submittedAt && byMonth.get(monthKey(r.submittedAt));
      if (bucket) bucket.submitted += 1;
    }
    for (const r of decidedRows) {
      const bucket = r.decidedAt && byMonth.get(monthKey(r.decidedAt));
      if (bucket) bucket.decided += 1;
    }
    for (const r of issuedRows) {
      const bucket = byMonth.get(monthKey(r.issuedAt));
      if (bucket) bucket.issued += 1;
    }

    // ── Outcome mix ──
    const countOf = (statuses: ApplicationStatus[]) =>
      statusGroups
        .filter((g) => statuses.includes(g.status))
        .reduce((sum, g) => sum + g._count._all, 0);
    const outcomes = [
      { name: "Cleared", value: countOf(CLEARED) },
      { name: "Objection", value: countOf(OBJECTED) },
      { name: "Under study", value: countOf(["STUDY"]) },
      { name: "In progress", value: countOf(IN_PROGRESS) },
    ].filter((o) => o.value > 0);

    // ── Per-airport cleared vs objections ──
    const airportIds = [...new Set(airportStatusGroups.map((g) => g.airportId))];
    const airports = await prisma.airport.findMany({
      where: { id: { in: airportIds } },
      select: { id: true, icao: true },
    });
    const icaoById = new Map(airports.map((a) => [a.id, a.icao]));
    const airportAcc = new Map<string, { icao: string; total: number; cleared: number; objections: number }>();
    for (const g of airportStatusGroups) {
      const icao = icaoById.get(g.airportId) ?? "—";
      const entry =
        airportAcc.get(icao) ?? { icao, total: 0, cleared: 0, objections: 0 };
      entry.total += g._count._all;
      if (CLEARED.includes(g.status)) entry.cleared += g._count._all;
      if (OBJECTED.includes(g.status)) entry.objections += g._count._all;
      airportAcc.set(icao, entry);
    }
    const byAirport = [...airportAcc.values()].sort((a, b) => b.total - a.total);

    // ── Authority league table (top 10 by volume) ──
    const authorityAcc = new Map<
      string,
      { name: string; total: number; endorsed: number; daysSum: number; daysCount: number }
    >();
    for (const row of authorityRows) {
      const name = row.authorityOrg?.name ?? "Unknown authority";
      const entry =
        authorityAcc.get(name) ?? { name, total: 0, endorsed: 0, daysSum: 0, daysCount: 0 };
      entry.total += 1;
      const endorseAt = row.caseEvents[0]?.at ?? null;
      if (endorseAt || POST_ENDORSEMENT.includes(row.status)) entry.endorsed += 1;
      if (endorseAt && row.submittedAt) {
        const days = (endorseAt.getTime() - row.submittedAt.getTime()) / 86_400_000;
        if (days >= 0) {
          entry.daysSum += days;
          entry.daysCount += 1;
        }
      }
      authorityAcc.set(name, entry);
    }
    const byAuthority = [...authorityAcc.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map((a) => ({
        name: a.name,
        total: a.total,
        endorsed: a.endorsed,
        avgEndorseDays: a.daysCount === 0 ? null : round1(a.daysSum / a.daysCount),
      }));

    // ── Structure-type mix ──
    const byStructureType = typeGroups.map((g) => ({
      type: g.structureType,
      count: g._count._all,
      avgHeight: round1(g._avg.requestedHeightAglM ?? 0),
    }));

    // ── Turnaround (percentiles computed in JS, capped at 2000 rows) ──
    const dayDiffs = decidedRows
      .map((r) => (r.decidedAt!.getTime() - r.submittedAt!.getTime()) / 86_400_000)
      .filter((d) => d >= 0)
      .sort((a, b) => a - b);
    const buckets = TURNAROUND_BUCKETS.map((b) => ({
      range: b.range,
      count: dayDiffs.filter((d) => d >= b.min && d <= b.max).length,
    }));
    const turnaround = {
      avgDays:
        dayDiffs.length === 0
          ? 0
          : round1(dayDiffs.reduce((sum, d) => sum + d, 0) / dayDiffs.length),
      p50: round1(percentile(dayDiffs, 0.5)),
      p90: round1(percentile(dayDiffs, 0.9)),
      buckets,
    };

    // ── Penetration map — latest penetrating evaluation per application ──
    const seen = new Set<string>();
    const penetrationMap: {
      lat: number;
      lon: number;
      penetrationM: number;
      refNo: string;
      icao: string;
      applicationId: string;
    }[] = [];
    for (const r of penetrationRows) {
      if (seen.has(r.applicationId)) continue; // rows are computedAt desc → keep latest
      seen.add(r.applicationId);
      penetrationMap.push({
        lat: r.application.lat,
        lon: r.application.lon,
        penetrationM: round2(r.penetrationM ?? 0),
        refNo: r.application.refNo,
        icao: r.application.airport.icao,
        applicationId: r.applicationId,
      });
    }

    // ── SLA compliance ──
    const compliant = Math.max(0, activeWithSla - breached);
    const sla = {
      compliant,
      breached,
      rate: activeWithSla === 0 ? 100 : round1((compliant / activeWithSla) * 100),
    };

    return Response.json({
      throughput,
      outcomes,
      byAirport,
      byAuthority,
      byStructureType,
      turnaround,
      penetrationMap,
      sla,
    });
  } catch (error) {
    return apiError(error);
  }
}
