// POST /api/applications/[id]/assign { disciplines?, officerId? }
// Intake: set assigned disciplines (AGA mandatory), case officer, create the
// empty DisciplineReview rows and store an authoritative server-side evaluation.
// officerId-only bodies support "assign to me" bulk action.
import { NextRequest } from "next/server";
import { z } from "zod";
import type { Discipline, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { addCaseEvent, writeAudit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notify";
import { loadAirport } from "@/lib/ols/server";
import { evaluate } from "@/lib/ols";
import type { Prisma } from "@prisma/client";

const bodySchema = z
  .object({
    disciplines: z.array(z.enum(["AGA", "CNS", "PANSOPS"])).min(1).optional(),
    officerId: z.string().trim().min(1).optional(),
  })
  .refine((b) => b.disciplines !== undefined || b.officerId !== undefined, {
    message: "Provide disciplines and/or an officer",
  })
  .refine((b) => !b.disciplines || b.disciplines.includes("AGA"), {
    message: "AGA is mandatory",
    path: ["disciplines"],
  });

const ASSIGNABLE_STATUSES = ["ENDORSED", "INTAKE_SCRUTINY", "UNDER_REVIEW", "STUDY"];

const REVIEWER_ROLE: Record<Discipline, Role> = {
  AGA: "AGA_REVIEWER",
  CNS: "CNS_REVIEWER",
  PANSOPS: "PANSOPS_REVIEWER",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCapability("application.intake");
    const { id } = await params;

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { disciplines, officerId } = parsed.data;

    const app = await prisma.application.findUnique({
      where: { id },
      include: { airport: { select: { id: true, icao: true, name: true } } },
    });
    if (!app) return Response.json({ error: "Application not found" }, { status: 404 });
    if (!ASSIGNABLE_STATUSES.includes(app.status)) {
      return Response.json(
        { error: `Cannot assign a case in status ${app.status}` },
        { status: 409 }
      );
    }

    // Validate officer, when given
    let officerName: string | null = null;
    if (officerId) {
      const officer = await prisma.user.findUnique({
        where: { id: officerId },
        select: { id: true, name: true, active: true, role: true },
      });
      if (!officer || !officer.active) {
        return Response.json({ error: "Officer not found" }, { status: 404 });
      }
      officerName = officer.name;
    }

    const data: Prisma.ApplicationUpdateInput = {};
    if (officerId) data.assignedOfficer = { connect: { id: officerId } };
    if (disciplines) data.assignedDisciplines = disciplines as Discipline[];
    const updated = await prisma.application.update({ where: { id: app.id }, data });

    let evaluation: unknown = null;
    if (disciplines) {
      // Empty review rows per discipline (idempotent)
      await prisma.disciplineReview.createMany({
        data: disciplines.map((d) => ({ applicationId: app.id, discipline: d as Discipline })),
        skipDuplicates: true,
      });

      // Authoritative server-side evaluation stored on the case
      const loaded = await loadAirport(app.airport.icao);
      if (loaded) {
        const result = evaluate(loaded.ols, loaded.params, {
          lat: app.lat,
          lon: app.lon,
          groundElevationM: app.groundElevationM,
          requestedHeightAglM: app.requestedHeightAglM,
        });
        evaluation = result;
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
      }

      // Notify the discipline reviewers
      const reviewers = await prisma.user.findMany({
        where: {
          active: true,
          role: { in: disciplines.map((d) => REVIEWER_ROLE[d as Discipline]) },
        },
        select: { id: true },
      });
      await notifyMany(
        reviewers.map((u) => u.id),
        {
          event: "APPLICATION_ASSIGNED",
          title: `Case ${app.refNo} assigned for review`,
          body: `${app.structureType} near ${app.airport.icao} — disciplines: ${disciplines.join(", ")}.`,
          link: `/applications/${app.id}`,
        }
      );
    }

    if (officerId && officerId !== user.id) {
      await notify({
        userId: officerId,
        event: "APPLICATION_ASSIGNED",
        title: `Case ${app.refNo} assigned to you`,
        body: `${app.structureType} near ${app.airport.icao}.`,
        link: `/applications/${app.id}`,
      });
    }

    const noteParts: string[] = [];
    if (disciplines) noteParts.push(`Disciplines: ${disciplines.join(", ")}`);
    if (officerId) noteParts.push(`Case officer: ${officerName ?? officerId}`);
    await addCaseEvent({
      applicationId: app.id,
      type: "ASSIGNED",
      actorId: user.id,
      note: noteParts.join(" · "),
      internal: true,
    });

    await writeAudit({
      actorId: user.id,
      action: "application.assign",
      entity: "Application",
      entityId: app.id,
      before: {
        assignedDisciplines: app.assignedDisciplines,
        assignedOfficerId: app.assignedOfficerId,
      },
      after: {
        assignedDisciplines: updated.assignedDisciplines,
        assignedOfficerId: updated.assignedOfficerId,
      },
    });

    return Response.json({ application: updated, evaluation });
  } catch (error) {
    return apiError(error);
  }
}
