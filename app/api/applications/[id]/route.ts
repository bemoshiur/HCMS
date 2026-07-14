// GET /api/applications/[id] — full case detail, role-scoped.
// Includes OLS map footprints for the mini-map and (for intake) assignable officers.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, apiError } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { loadAirport } from "@/lib/ols/server";
import { surfaceFootprints, runwayLines } from "@/lib/ols";
import { canViewApplication, isCaabRole } from "../_lib/scope";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const app = await prisma.application.findUnique({
      where: { id },
      include: {
        applicantOrg: { select: { id: true, name: true, contact: true, city: true, tradeLicense: true } },
        authorityOrg: { select: { id: true, name: true, authorityCode: true, city: true } },
        airport: {
          select: {
            id: true,
            icao: true,
            name: true,
            city: true,
            elevationM: true,
            referenceLat: true,
            referenceLon: true,
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
        assignedOfficer: { select: { id: true, name: true, email: true } },
        evaluationResults: { orderBy: { computedAt: "desc" } },
        disciplineReviews: {
          orderBy: { discipline: "asc" },
          include: { reviewer: { select: { id: true, name: true } } },
        },
        studies: {
          orderBy: { createdAt: "desc" },
          include: { officer: { select: { id: true, name: true } } },
        },
        certificates: {
          orderBy: { issuedAt: "desc" },
          select: {
            id: true,
            hcNo: true,
            decision: true,
            status: true,
            ptE_amslM: true,
            permissibleAglM: true,
            governingSurface: true,
            conditions: true,
            validFrom: true,
            validTo: true,
            issuedAt: true,
          },
        },
        documents: {
          orderBy: [{ type: "asc" }, { version: "desc" }],
          include: { uploadedBy: { select: { id: true, name: true } } },
        },
        caseEvents: {
          orderBy: { at: "desc" },
          include: { actor: { select: { id: true, name: true, role: true } } },
        },
      },
    });

    if (!app) return Response.json({ error: "Application not found" }, { status: 404 });
    if (!canViewApplication(user, app)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const caab = isCaabRole(user.role);
    // Internal notes/events stay inside CAAB
    const caseEvents = caab ? app.caseEvents : app.caseEvents.filter((e) => !e.internal);

    // Mini-map payload (footprints computed from the active parameter set)
    let map: {
      center: [number, number];
      surfaces: unknown;
      runways: unknown;
      paramSetVersion: number | null;
    } | null = null;
    try {
      const loaded = await loadAirport(app.airport.icao);
      if (loaded) {
        map = {
          center: [app.airport.referenceLon, app.airport.referenceLat],
          surfaces: surfaceFootprints(loaded.ols, loaded.params),
          runways: runwayLines(loaded.ols),
          paramSetVersion: loaded.paramSetVersion,
        };
      }
    } catch {
      map = null; // map is decorative — never fail the case detail for it
    }

    // Officers the intake dialog may assign as case officer
    let assignableOfficers: Array<{ id: string; name: string; role: string }> = [];
    if (can(user.role, "application.intake")) {
      assignableOfficers = (
        await prisma.user.findMany({
          where: { active: true, role: { in: ["INTAKE_OFFICER", "AGA_REVIEWER", "CNS_REVIEWER", "PANSOPS_REVIEWER"] } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, role: true },
        })
      ).map((u) => ({ ...u, role: u.role as string }));
    }

    return Response.json({
      application: { ...app, caseEvents },
      map,
      assignableOfficers,
      viewer: {
        role: user.role,
        isCaab: caab,
        canIntake: can(user.role, "application.intake"),
        canDecide: can(user.role, "application.decide"),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
