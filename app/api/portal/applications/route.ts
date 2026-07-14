// Applicant portal — POST creates a DRAFT application (wizard), GET lists the
// caller's own applications (light) or, with ?authorities=1[&icao=], the
// approving-authority organisations for the selected airport's city.
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, requireUser, apiError } from "@/lib/auth/guards";
import { nextApplicationRef } from "@/lib/numbering";
import { addCaseEvent, writeAudit } from "@/lib/audit";

const draftSchema = z.object({
  icao: z.string().trim().min(3).max(4),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  groundElevationM: z.number().min(-100).max(2000),
  requestedHeightAglM: z.number().min(0.1).max(1000),
  structureType: z.string().trim().min(2).max(80),
  siteAddress: z.string().trim().max(300).optional(),
  contactPerson: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  contactEmail: z.string().trim().max(160).optional(),
  purpose: z.string().trim().max(2000).optional(),
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCapability("application.create");
    if (!user.orgId) {
      return Response.json(
        { error: "Your account is not linked to an applicant organisation" },
        { status: 403 }
      );
    }

    const json = await request.json().catch(() => null);
    const parsed = draftSchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const airport = await prisma.airport.findFirst({
      where: { icao: data.icao.toUpperCase(), active: true },
      select: { id: true, icao: true, name: true },
    });
    if (!airport) return Response.json({ error: "Airport not found" }, { status: 404 });

    const refNo = await nextApplicationRef(airport.icao);
    const application = await prisma.application.create({
      data: {
        refNo,
        applicantOrgId: user.orgId,
        airportId: airport.id,
        structureType: data.structureType,
        siteAddress: data.siteAddress ?? null,
        lat: data.lat,
        lon: data.lon,
        groundElevationM: data.groundElevationM,
        requestedHeightAglM: data.requestedHeightAglM,
        requestedTopElevationAmslM: round2(data.groundElevationM + data.requestedHeightAglM),
        status: "DRAFT",
        createdById: user.id,
      },
      select: { id: true, refNo: true, status: true, createdAt: true },
    });

    const contactBits = [
      data.contactPerson ? `Contact: ${data.contactPerson}` : null,
      data.contactPhone ?? null,
      data.contactEmail ?? null,
    ].filter(Boolean);
    await addCaseEvent({
      applicationId: application.id,
      type: "CREATED",
      actorId: user.id,
      note: `Draft created via the applicant portal.${contactBits.length ? ` ${contactBits.join(" · ")}` : ""}`,
    });
    await writeAudit({
      actorId: user.id,
      action: "application.create",
      entity: "Application",
      entityId: application.id,
      after: {
        refNo,
        icao: airport.icao,
        structureType: data.structureType,
        requestedHeightAglM: data.requestedHeightAglM,
      },
    });

    return Response.json({ application }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const params = request.nextUrl.searchParams;

    // Approving-authority directory for the wizard (filtered by airport city).
    if (params.get("authorities")) {
      const icao = params.get("icao")?.trim().toUpperCase() || null;
      let cities: string[] | null = null;
      if (icao) {
        const airport = await prisma.airport.findUnique({
          where: { icao },
          select: { city: true },
        });
        if (!airport) return Response.json({ error: "Airport not found" }, { status: 404 });
        cities = [airport.city, "National"];
      }
      const authorities = await prisma.organization.findMany({
        where: {
          type: "AUTHORITY",
          active: true,
          ...(cities ? { city: { in: cities } } : {}),
        },
        orderBy: [{ city: "asc" }, { name: "asc" }],
        select: { id: true, name: true, authorityCode: true, city: true },
      });
      return Response.json({ authorities });
    }

    // Own drafts + applications (light list).
    const applications = await prisma.application.findMany({
      where: {
        OR: [{ createdById: user.id }, { applicantOrgId: user.orgId ?? "__none__" }],
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        refNo: true,
        status: true,
        structureType: true,
        requestedHeightAglM: true,
        slaDueAt: true,
        submittedAt: true,
        createdAt: true,
        airport: { select: { icao: true, name: true } },
      },
    });
    return Response.json({ applications });
  } catch (error) {
    return apiError(error);
  }
}
