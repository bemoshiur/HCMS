// POST /api/portal/applications/[id]/submit — final wizard step.
// Accepts the full payload, updates the draft, validates completeness
// (required documents + approving authority), runs the authoritative
// server-side OLS evaluation, and moves the case to SUBMITTED.
import { NextRequest } from "next/server";
import { z } from "zod";
import type { DocumentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { roleMayTransition, slaDueDate } from "@/lib/workflow";
import { addCaseEvent, writeAudit } from "@/lib/audit";
import { notifyMany } from "@/lib/notify";
import { loadAirport } from "@/lib/ols/server";
import { evaluate } from "@/lib/ols";

const submitSchema = z.object({
  icao: z.string().trim().min(3).max(4),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  groundElevationM: z.number().min(-100).max(2000),
  requestedHeightAglM: z.number().min(0.1).max(1000),
  structureType: z.string().trim().min(2).max(80),
  siteAddress: z.string().trim().min(5).max(300),
  authorityOrgId: z.string().trim().min(1),
  contactPerson: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  contactEmail: z.string().trim().max(160).optional(),
  purpose: z.string().trim().max(2000).optional(),
  declaration: z.literal(true),
});

const REQUIRED_DOC_TYPES: DocumentType[] = [
  "OWNERSHIP",
  "SITE_PLAN",
  "ELEVATION_CERT",
  "MOUZA_MAP",
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCapability("application.create");
    const { id } = await params;

    const json = await request.json().catch(() => null);
    const parsed = submitSchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const app = await prisma.application.findUnique({
      where: { id },
      select: {
        id: true,
        refNo: true,
        status: true,
        submittedAt: true,
        applicantOrgId: true,
        createdById: true,
        documents: { select: { type: true } },
      },
    });
    if (!app) return Response.json({ error: "Application not found" }, { status: 404 });
    const owns = app.createdById === user.id || (!!user.orgId && app.applicantOrgId === user.orgId);
    if (!owns) return Response.json({ error: "Forbidden" }, { status: 403 });

    if (!roleMayTransition(user.role, app.status, "SUBMITTED")) {
      return Response.json(
        { error: `An application in status ${app.status} cannot be submitted` },
        { status: 409 }
      );
    }

    // Completeness — required document types must be present.
    const present = new Set(app.documents.map((d) => d.type));
    const missing = REQUIRED_DOC_TYPES.filter((t) => !present.has(t));
    if (missing.length > 0) {
      return Response.json(
        { error: `Missing required documents: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Approving authority must be a real AUTHORITY organisation.
    const authority = await prisma.organization.findFirst({
      where: { id: data.authorityOrgId, type: "AUTHORITY", active: true },
      select: { id: true, name: true },
    });
    if (!authority) {
      return Response.json({ error: "Approving authority not found" }, { status: 400 });
    }

    // Airport + authoritative server-side OLS evaluation.
    const loaded = await loadAirport(data.icao);
    if (!loaded) return Response.json({ error: "Airport not found" }, { status: 404 });
    const result = evaluate(loaded.ols, loaded.params, {
      lat: data.lat,
      lon: data.lon,
      groundElevationM: data.groundElevationM,
      requestedHeightAglM: data.requestedHeightAglM,
    });

    const now = new Date();
    const updated = await prisma.application.update({
      where: { id: app.id },
      data: {
        airportId: loaded.id,
        authorityOrgId: authority.id,
        structureType: data.structureType,
        siteAddress: data.siteAddress,
        lat: data.lat,
        lon: data.lon,
        groundElevationM: data.groundElevationM,
        requestedHeightAglM: data.requestedHeightAglM,
        requestedTopElevationAmslM: round2(data.groundElevationM + data.requestedHeightAglM),
        status: "SUBMITTED",
        submittedAt: now,
        slaDueAt: slaDueDate("SUBMITTED", now),
      },
      select: { id: true, refNo: true, status: true, submittedAt: true, slaDueAt: true },
    });

    await prisma.evaluationResult.create({
      data: {
        applicationId: app.id,
        governingSurface: result.governingSurface,
        ptE_amslM: result.ptE_amslM,
        permissibleAglM: result.permissibleAglM,
        penetrationM: result.penetrationM,
        status: result.status,
        surfaces: result as unknown as Prisma.InputJsonValue,
        engineVersion: result.engineVersion,
      },
    });

    const noteBits = [
      `Application submitted via the applicant portal to ${authority.name}.`,
      data.contactPerson
        ? `Contact: ${[data.contactPerson, data.contactPhone, data.contactEmail].filter(Boolean).join(" · ")}`
        : null,
      data.purpose ? `Purpose: ${data.purpose}` : null,
    ].filter(Boolean);
    await addCaseEvent({
      applicationId: app.id,
      type: "SUBMITTED",
      actorId: user.id,
      note: noteBits.join("\n"),
    });
    await writeAudit({
      actorId: user.id,
      action: "application.submit",
      entity: "Application",
      entityId: app.id,
      before: { status: app.status },
      after: {
        status: "SUBMITTED",
        authorityOrgId: authority.id,
        evaluation: {
          status: result.status,
          ptE_amslM: result.ptE_amslM,
          governingSurface: result.governingSurface,
        },
      },
    });

    const officers = await prisma.user.findMany({
      where: { role: "AUTHORITY_OFFICER", orgId: authority.id, active: true },
      select: { id: true },
    });
    await notifyMany(
      officers.map((u) => u.id),
      {
        event: "APPLICATION_SUBMITTED",
        title: `Application ${app.refNo} awaits endorsement`,
        body: `${data.structureType} near ${loaded.icao} (${data.requestedHeightAglM.toFixed(1)} m AGL) submitted for endorsement to CAAB.`,
        link: "/authority",
      }
    );

    return Response.json({ application: updated });
  } catch (error) {
    return apiError(error);
  }
}
