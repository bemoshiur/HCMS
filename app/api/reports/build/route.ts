// POST /api/reports/build — ad-hoc report builder (§17 reporting).
// Body: { entity, filters, columns, format }. Columns are validated against a
// strict per-entity allowlist; rows are role-scoped exactly like the lists.
// format "json" → { headers, rows, total, limit } preview (≤200 rows);
// format "csv"  → full attachment (≤5000 rows) via toCsv().
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  ApplicationStatus,
  CertStatus,
  ObstacleStatus,
  type Prisma,
} from "@prisma/client";
import { format as fmt } from "date-fns";
import { prisma } from "@/lib/db";
import { requireCapability, apiError, type SessionUser } from "@/lib/auth/guards";
import { roleScopeWhere } from "@/app/api/applications/_lib/scope";
import { writeAudit } from "@/lib/audit";
import { toCsv } from "@/lib/format";

export const dynamic = "force-dynamic";

// ─────────────────────────────── Schema ───────────────────────────────

const filtersSchema = z
  .object({
    icao: z.string().trim().max(4).optional(),
    status: z.string().trim().max(40).optional(),
    from: z.string().trim().max(20).optional(), // ISO date yyyy-mm-dd
    to: z.string().trim().max(20).optional(),
    structureType: z.string().trim().max(80).optional(),
  })
  .default({});

const bodySchema = z.object({
  entity: z.enum(["applications", "certificates", "obstacles"]),
  filters: filtersSchema,
  columns: z.array(z.string().trim().max(40)).min(1).max(24),
  format: z.enum(["json", "csv"]),
});

type ReportFilters = z.infer<typeof filtersSchema>;
type Cell = string | number | null;

const PREVIEW_LIMIT = 200;
const CSV_LIMIT = 5000;

const dt = (d: Date | null | undefined): string | null =>
  d ? fmt(d, "yyyy-MM-dd HH:mm") : null;
const day = (d: Date | null | undefined): string | null =>
  d ? fmt(d, "yyyy-MM-dd") : null;

function parseDate(value: string | undefined, endOfDay = false): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

// ─────────────────────── Applications ───────────────────────

const appSelect = {
  refNo: true,
  structureType: true,
  siteAddress: true,
  lat: true,
  lon: true,
  groundElevationM: true,
  requestedHeightAglM: true,
  status: true,
  submittedAt: true,
  decidedAt: true,
  slaDueAt: true,
  applicantOrg: { select: { name: true } },
  authorityOrg: { select: { name: true } },
  airport: { select: { icao: true } },
  evaluationResults: {
    orderBy: { computedAt: "desc" },
    take: 1,
    select: { status: true, ptE_amslM: true, penetrationM: true },
  },
} satisfies Prisma.ApplicationSelect;
type AppRow = Prisma.ApplicationGetPayload<{ select: typeof appSelect }>;

const APPLICATION_COLUMNS: Record<string, { header: string; value: (r: AppRow) => Cell }> = {
  refNo: { header: "Reference No.", value: (r) => r.refNo },
  applicant: { header: "Applicant", value: (r) => r.applicantOrg.name },
  authority: { header: "Approving Authority", value: (r) => r.authorityOrg?.name ?? null },
  airport: { header: "Airport", value: (r) => r.airport.icao },
  structureType: { header: "Structure Type", value: (r) => r.structureType },
  siteAddress: { header: "Site Address", value: (r) => r.siteAddress ?? null },
  lat: { header: "Latitude", value: (r) => r.lat },
  lon: { header: "Longitude", value: (r) => r.lon },
  groundElevationM: { header: "Ground Elevation (m AMSL)", value: (r) => r.groundElevationM },
  requestedHeightAglM: { header: "Requested Height (m AGL)", value: (r) => r.requestedHeightAglM },
  status: { header: "Status", value: (r) => r.status },
  evalStatus: { header: "Evaluation", value: (r) => r.evaluationResults[0]?.status ?? null },
  ptE_amslM: {
    header: "Permissible Elevation (m AMSL)",
    value: (r) => r.evaluationResults[0]?.ptE_amslM ?? null,
  },
  penetrationM: {
    header: "Penetration (m)",
    value: (r) => r.evaluationResults[0]?.penetrationM ?? null,
  },
  submittedAt: { header: "Submitted At", value: (r) => dt(r.submittedAt) },
  decidedAt: { header: "Decided At", value: (r) => dt(r.decidedAt) },
  slaDueAt: { header: "SLA Due", value: (r) => dt(r.slaDueAt) },
};

function applicationWhere(user: SessionUser, f: ReportFilters): Prisma.ApplicationWhereInput {
  const and: Prisma.ApplicationWhereInput[] = [roleScopeWhere(user)];
  if (f.icao) and.push({ airport: { icao: f.icao.toUpperCase() } });
  if (f.status) and.push({ status: f.status as ApplicationStatus });
  if (f.structureType)
    and.push({ structureType: { contains: f.structureType, mode: "insensitive" } });
  const from = parseDate(f.from);
  const to = parseDate(f.to, true);
  if (from) and.push({ submittedAt: { gte: from } });
  if (to) and.push({ submittedAt: { lte: to } });
  return { AND: and };
}

// ─────────────────────── Certificates ───────────────────────

const certSelect = {
  hcNo: true,
  ptE_amslM: true,
  permissibleAglM: true,
  governingSurface: true,
  status: true,
  validFrom: true,
  validTo: true,
  issuedAt: true,
  application: {
    select: {
      refNo: true,
      applicantOrg: { select: { name: true } },
      airport: { select: { icao: true } },
    },
  },
  signedBy: { select: { name: true } },
} satisfies Prisma.CertificateSelect;
type CertRow = Prisma.CertificateGetPayload<{ select: typeof certSelect }>;

const CERTIFICATE_COLUMNS: Record<string, { header: string; value: (r: CertRow) => Cell }> = {
  hcNo: { header: "HC No.", value: (r) => r.hcNo },
  refNo: { header: "Reference No.", value: (r) => r.application.refNo },
  applicant: { header: "Applicant", value: (r) => r.application.applicantOrg.name },
  airport: { header: "Airport", value: (r) => r.application.airport.icao },
  ptE_amslM: { header: "Permissible Elevation (m AMSL)", value: (r) => r.ptE_amslM },
  permissibleAglM: { header: "Permissible Height (m AGL)", value: (r) => r.permissibleAglM },
  governingSurface: { header: "Governing Surface", value: (r) => r.governingSurface ?? null },
  status: { header: "Status", value: (r) => r.status },
  validFrom: { header: "Valid From", value: (r) => day(r.validFrom) },
  validTo: { header: "Valid To", value: (r) => day(r.validTo) },
  issuedAt: { header: "Issued At", value: (r) => dt(r.issuedAt) },
  signedBy: { header: "Signed By", value: (r) => r.signedBy?.name ?? null },
};

function certificateWhere(user: SessionUser, f: ReportFilters): Prisma.CertificateWhereInput {
  const appAnd: Prisma.ApplicationWhereInput[] = [roleScopeWhere(user)];
  if (f.icao) appAnd.push({ airport: { icao: f.icao.toUpperCase() } });
  if (f.structureType)
    appAnd.push({ structureType: { contains: f.structureType, mode: "insensitive" } });
  const and: Prisma.CertificateWhereInput[] = [{ application: { AND: appAnd } }];
  if (f.status) and.push({ status: f.status as CertStatus });
  const from = parseDate(f.from);
  const to = parseDate(f.to, true);
  if (from) and.push({ issuedAt: { gte: from } });
  if (to) and.push({ issuedAt: { lte: to } });
  return { AND: and };
}

// ─────────────────────── Obstacles ───────────────────────

const obstacleSelect = {
  name: true,
  structureType: true,
  lat: true,
  lon: true,
  topElevationAmslM: true,
  heightAglM: true,
  source: true,
  status: true,
  lastCheckedAt: true,
  airport: { select: { icao: true } },
} satisfies Prisma.ObstacleSelect;
type ObstacleRow = Prisma.ObstacleGetPayload<{ select: typeof obstacleSelect }>;

const OBSTACLE_COLUMNS: Record<string, { header: string; value: (r: ObstacleRow) => Cell }> = {
  name: { header: "Name", value: (r) => r.name ?? null },
  airport: { header: "Airport", value: (r) => r.airport.icao },
  structureType: { header: "Structure Type", value: (r) => r.structureType },
  lat: { header: "Latitude", value: (r) => r.lat },
  lon: { header: "Longitude", value: (r) => r.lon },
  topElevationAmslM: { header: "Top Elevation (m AMSL)", value: (r) => r.topElevationAmslM },
  heightAglM: { header: "Height (m AGL)", value: (r) => r.heightAglM ?? null },
  source: { header: "Source", value: (r) => r.source },
  status: { header: "Status", value: (r) => r.status },
  lastCheckedAt: { header: "Last Checked", value: (r) => dt(r.lastCheckedAt) },
};

function obstacleWhere(user: SessionUser, f: ReportFilters): Prisma.ObstacleWhereInput {
  const and: Prisma.ObstacleWhereInput[] = [];
  // Role scope: portal roles only see obstacles linked to their own cases.
  if (user.role === "APPLICANT") {
    and.push({
      linkedApplication: {
        is: {
          OR: [{ applicantOrgId: user.orgId ?? "__none__" }, { createdById: user.id }],
        },
      },
    });
  } else if (user.role === "AUTHORITY_OFFICER") {
    and.push({ linkedApplication: { is: { authorityOrgId: user.orgId ?? "__none__" } } });
  }
  if (f.icao) and.push({ airport: { icao: f.icao.toUpperCase() } });
  if (f.status) and.push({ status: f.status as ObstacleStatus });
  if (f.structureType)
    and.push({ structureType: { contains: f.structureType, mode: "insensitive" } });
  const from = parseDate(f.from);
  const to = parseDate(f.to, true);
  if (from) and.push({ createdAt: { gte: from } });
  if (to) and.push({ createdAt: { lte: to } });
  return and.length ? { AND: and } : {};
}

// ─────────────────────── Entity registry ───────────────────────

const STATUS_VALUES: Record<string, string[]> = {
  applications: Object.values(ApplicationStatus),
  certificates: Object.values(CertStatus),
  obstacles: Object.values(ObstacleStatus),
};

const COLUMN_SPECS: Record<string, Record<string, { header: string; value: (r: never) => Cell }>> = {
  applications: APPLICATION_COLUMNS,
  certificates: CERTIFICATE_COLUMNS,
  obstacles: OBSTACLE_COLUMNS,
};

async function fetchRows(
  entity: "applications" | "certificates" | "obstacles",
  user: SessionUser,
  filters: ReportFilters,
  limit: number
): Promise<{ total: number; rows: unknown[] }> {
  if (entity === "applications") {
    const where = applicationWhere(user, filters);
    const [total, rows] = await Promise.all([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        take: limit,
        select: appSelect,
      }),
    ]);
    return { total, rows };
  }
  if (entity === "certificates") {
    const where = certificateWhere(user, filters);
    const [total, rows] = await Promise.all([
      prisma.certificate.count({ where }),
      prisma.certificate.findMany({
        where,
        orderBy: { issuedAt: "desc" },
        take: limit,
        select: certSelect,
      }),
    ]);
    return { total, rows };
  }
  const where = obstacleWhere(user, filters);
  const [total, rows] = await Promise.all([
    prisma.obstacle.count({ where }),
    prisma.obstacle.findMany({
      where,
      orderBy: { topElevationAmslM: "desc" },
      take: limit,
      select: obstacleSelect,
    }),
  ]);
  return { total, rows };
}

// ─────────────────────────────── Handler ───────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await requireCapability("report.view");

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { entity, filters, columns, format } = parsed.data;

    // Validate columns against the per-entity allowlist
    const specs = COLUMN_SPECS[entity];
    const invalid = columns.filter((c) => !(c in specs));
    if (invalid.length > 0) {
      return Response.json(
        { error: `Unknown columns for ${entity}: ${invalid.join(", ")}` },
        { status: 400 }
      );
    }
    // Validate status against the entity's enum
    if (filters.status && !STATUS_VALUES[entity].includes(filters.status)) {
      return Response.json(
        { error: `Invalid status for ${entity}: ${filters.status}` },
        { status: 400 }
      );
    }

    // Preserve allowlist order and dedupe requested columns
    const ordered = Object.keys(specs).filter((key) => columns.includes(key));
    const headers = ordered.map((key) => specs[key].header);

    const limit = format === "csv" ? CSV_LIMIT : PREVIEW_LIMIT;
    const { total, rows } = await fetchRows(entity, user, filters, limit);
    const cells = rows.map((row) => ordered.map((key) => specs[key].value(row as never)));

    if (format === "csv") {
      await writeAudit({
        actorId: user.id,
        action: "report.export",
        entity: "Report",
        after: { entity, columns: ordered, filters, rows: cells.length, total },
      });
      const filename = `hcms-${entity}-report-${fmt(new Date(), "yyyyMMdd-HHmm")}.csv`;
      return new Response(toCsv(headers, cells), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return Response.json({ headers, rows: cells, total, limit: PREVIEW_LIMIT });
  } catch (error) {
    return apiError(error);
  }
}
