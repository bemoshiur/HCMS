// Role-aware dashboard aggregates (§17 — reporting/analytics, dashboard half).
// Read-only: scoped like the applications list. APPLICANT → own org,
// AUTHORITY_OFFICER → own authority org, everyone else → all cases.
import { prisma } from "@/lib/db";
import { requireUser, apiError, type SessionUser } from "@/lib/auth/guards";
import { reviewerDiscipline } from "@/lib/auth/permissions";
import { ACTIVE_STATUSES } from "@/lib/workflow";
import type { ApplicationStatus, Prisma } from "@prisma/client";
import { format, startOfMonth, subMonths } from "date-fns";

export const dynamic = "force-dynamic";

// ─────────────────────────── Response types ───────────────────────────

export type DashboardQueue =
  | { kind: "review"; discipline: "AGA" | "CNS" | "PANSOPS"; pending: number }
  | {
      kind: "decision";
      pending: number;
      items: { id: string; refNo: string; applicantName: string; slaDueAt: string | null }[];
    }
  | { kind: "intake"; endorsed: number; scrutiny: number }
  | { kind: "study"; pending: number }
  | null;

function scopeFor(user: SessionUser): Prisma.ApplicationWhereInput {
  if (user.role === "APPLICANT") return { applicantOrgId: user.orgId ?? "__none__" };
  if (user.role === "AUTHORITY_OFFICER") return { authorityOrgId: user.orgId ?? "__none__" };
  return {};
}

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

const round1 = (n: number) => Math.round(n * 10) / 10;

async function queueFor(user: SessionUser): Promise<DashboardQueue> {
  const discipline = reviewerDiscipline(user.role);
  if (discipline) {
    const pending = await prisma.disciplineReview.count({
      where: { discipline, verdict: null, application: { status: "UNDER_REVIEW" } },
    });
    return { kind: "review", discipline, pending };
  }
  if (user.role === "APPROVER") {
    const [pending, rows] = await Promise.all([
      prisma.application.count({ where: { status: "DECISION_PENDING" } }),
      prisma.application.findMany({
        where: { status: "DECISION_PENDING" },
        orderBy: { slaDueAt: "asc" },
        take: 5,
        select: {
          id: true,
          refNo: true,
          slaDueAt: true,
          applicantOrg: { select: { name: true } },
        },
      }),
    ]);
    return {
      kind: "decision",
      pending,
      items: rows.map((r) => ({
        id: r.id,
        refNo: r.refNo,
        applicantName: r.applicantOrg.name,
        slaDueAt: r.slaDueAt ? r.slaDueAt.toISOString() : null,
      })),
    };
  }
  if (user.role === "INTAKE_OFFICER") {
    const [endorsed, scrutiny] = await Promise.all([
      prisma.application.count({ where: { status: "ENDORSED" } }),
      prisma.application.count({ where: { status: "INTAKE_SCRUTINY" } }),
    ]);
    return { kind: "intake", endorsed, scrutiny };
  }
  if (user.role === "STUDY_OFFICER") {
    const pending = await prisma.application.count({ where: { status: "STUDY" } });
    return { kind: "study", pending };
  }
  return null;
}

export async function GET() {
  try {
    const user = await requireUser();
    const scope = scopeFor(user);
    const now = new Date();
    const monthsStart = startOfMonth(subMonths(now, 7));

    const [
      statusGroups,
      certificatesIssued,
      decidedRows,
      activeWithSla,
      breached,
      permAgg,
      submittedRows,
      decidedMonthlyRows,
      airportGroups,
      typeGroups,
      recentRows,
      myQueue,
    ] = await Promise.all([
      prisma.application.groupBy({ by: ["status"], _count: { _all: true }, where: scope }),
      prisma.certificate.count({ where: { status: "ISSUED", application: scope } }),
      prisma.application.findMany({
        where: { ...scope, submittedAt: { not: null }, decidedAt: { not: null } },
        select: { submittedAt: true, decidedAt: true },
      }),
      prisma.application.count({
        where: { ...scope, status: { in: ACTIVE_STATUSES }, slaDueAt: { not: null } },
      }),
      prisma.application.count({
        where: { ...scope, status: { in: ACTIVE_STATUSES }, slaDueAt: { lt: now } },
      }),
      prisma.evaluationResult.aggregate({
        _avg: { permissibleAglM: true },
        where: { application: scope },
      }),
      prisma.application.findMany({
        where: { ...scope, submittedAt: { gte: monthsStart } },
        select: { submittedAt: true },
      }),
      prisma.application.findMany({
        where: { ...scope, decidedAt: { gte: monthsStart } },
        select: { decidedAt: true },
      }),
      prisma.application.groupBy({
        by: ["airportId"],
        _count: { _all: true },
        where: scope,
        orderBy: { _count: { airportId: "desc" } },
      }),
      prisma.application.groupBy({
        by: ["structureType"],
        _count: { _all: true },
        where: scope,
        orderBy: { _count: { structureType: "desc" } },
        take: 8,
      }),
      prisma.application.findMany({
        where: scope,
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          refNo: true,
          status: true,
          submittedAt: true,
          applicantOrg: { select: { name: true } },
          airport: { select: { icao: true } },
        },
      }),
      queueFor(user),
    ]);

    // ── KPIs from the single status groupBy ──
    const countOf = (statuses: ApplicationStatus[]) =>
      statusGroups
        .filter((g) => statuses.includes(g.status))
        .reduce((sum, g) => sum + g._count._all, 0);
    const total = statusGroups.reduce((sum, g) => sum + g._count._all, 0);
    const inProgress = countOf(ACTIVE_STATUSES);
    const approved = countOf(["APPROVED", "CERTIFICATE_ISSUED"]);
    const objections = countOf(OBJECTED);

    const avgTurnaroundDays =
      decidedRows.length === 0
        ? 0
        : round1(
            decidedRows.reduce(
              (sum, r) =>
                sum + (r.decidedAt!.getTime() - r.submittedAt!.getTime()) / 86_400_000,
              0
            ) / decidedRows.length
          );

    const slaComplianceRate =
      activeWithSla === 0 ? 100 : round1(((activeWithSla - breached) / activeWithSla) * 100);

    const avgPermissibleHeight = round1(permAgg._avg.permissibleAglM ?? 0);

    // ── Monthly throughput (last 8 calendar months, inclusive) ──
    const monthKey = (d: Date) => format(d, "MMM yy");
    const monthly = Array.from({ length: 8 }, (_, i) => ({
      month: monthKey(startOfMonth(subMonths(now, 7 - i))),
      submitted: 0,
      decided: 0,
    }));
    const byKey = new Map(monthly.map((m) => [m.month, m]));
    for (const r of submittedRows) {
      const bucket = r.submittedAt && byKey.get(monthKey(r.submittedAt));
      if (bucket) bucket.submitted += 1;
    }
    for (const r of decidedMonthlyRows) {
      const bucket = r.decidedAt && byKey.get(monthKey(r.decidedAt));
      if (bucket) bucket.decided += 1;
    }

    // ── Outcome mix ──
    const outcomes = [
      { name: "Cleared", value: countOf(CLEARED) },
      { name: "Objection", value: countOf(OBJECTED) },
      { name: "Under study", value: countOf(["STUDY"]) },
      { name: "In progress", value: countOf(IN_PROGRESS) },
    ].filter((o) => o.value > 0);

    // ── Per-airport (resolve ICAO codes in one lookup) ──
    const airports = await prisma.airport.findMany({
      where: { id: { in: airportGroups.map((g) => g.airportId) } },
      select: { id: true, icao: true },
    });
    const icaoById = new Map(airports.map((a) => [a.id, a.icao]));
    const byAirport = airportGroups.map((g) => ({
      icao: icaoById.get(g.airportId) ?? "—",
      count: g._count._all,
    }));

    const byStructureType = typeGroups.map((g) => ({
      type: g.structureType,
      count: g._count._all,
    }));

    const recent = recentRows.map((r) => ({
      id: r.id,
      refNo: r.refNo,
      applicantName: r.applicantOrg.name,
      airportIcao: r.airport.icao,
      status: r.status,
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    }));

    return Response.json({
      role: user.role,
      kpis: {
        total,
        inProgress,
        approved,
        objections,
        certificatesIssued,
        avgTurnaroundDays,
        slaComplianceRate,
        avgPermissibleHeight,
      },
      monthly,
      outcomes,
      byAirport,
      byStructureType,
      recent,
      myQueue,
    });
  } catch (error) {
    return apiError(error);
  }
}
