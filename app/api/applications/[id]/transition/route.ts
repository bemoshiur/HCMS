// POST /api/applications/[id]/transition { to, remarks? }
// The single mutation path for workflow state changes: legality via
// roleMayTransition, SLA reset, CaseEvent, AuditLog and notifications.
import { NextRequest } from "next/server";
import { z } from "zod";
import type { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, apiError } from "@/lib/auth/guards";
import { roleMayTransition, slaDueDate } from "@/lib/workflow";
import { addCaseEvent, writeAudit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notify";
import { canViewApplication, isCaabRole } from "../../_lib/scope";

const TARGET_STATUSES = [
  "SUBMITTED",
  "ENDORSED",
  "INTAKE_SCRUTINY",
  "UNDER_REVIEW",
  "STUDY",
  "DECISION_PENDING",
  "APPROVED",
  "REJECTED",
  "RETURNED_FOR_INFO",
  "CERTIFICATE_ISSUED",
  "REVALIDATION",
  "EXPIRED",
  "REVOKED",
] as const;

const bodySchema = z.object({
  to: z.enum(TARGET_STATUSES),
  remarks: z.string().trim().max(2000).optional(),
});

const REMARKS_REQUIRED: ApplicationStatus[] = ["RETURNED_FOR_INFO", "REJECTED"];
const TERMINAL_DECISIONS: ApplicationStatus[] = ["APPROVED", "REJECTED"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { to, remarks } = parsed.data;

    const app = await prisma.application.findUnique({
      where: { id },
      include: {
        airport: { select: { icao: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!app) return Response.json({ error: "Application not found" }, { status: 404 });
    if (!canViewApplication(user, app)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    // Non-CAAB users may only act on their own cases (already scoped above);
    // legality of the specific transition per role:
    if (!roleMayTransition(user.role, app.status, to)) {
      return Response.json(
        { error: `Transition ${app.status} → ${to} is not permitted for your role` },
        { status: 403 }
      );
    }
    if (REMARKS_REQUIRED.includes(to) && !remarks) {
      return Response.json(
        { error: "Remarks are required for this action" },
        { status: 400 }
      );
    }

    const now = new Date();
    const updated = await prisma.application.update({
      where: { id: app.id },
      data: {
        status: to,
        slaDueAt: slaDueDate(to, now),
        decidedAt: TERMINAL_DECISIONS.includes(to) ? now : app.decidedAt,
        submittedAt: to === "SUBMITTED" && !app.submittedAt ? now : app.submittedAt,
      },
    });

    await addCaseEvent({
      applicationId: app.id,
      type: to,
      actorId: user.id,
      note: remarks ?? null,
      internal: false,
    });

    await writeAudit({
      actorId: user.id,
      action: "application.transition",
      entity: "Application",
      entityId: app.id,
      before: { status: app.status },
      after: { status: to, remarks: remarks ?? null },
    });

    // Notifications per §13/§17
    const link = `/applications/${app.id}`;
    const creatorLink = `/portal/applications/${app.id}`;
    if (to === "RETURNED_FOR_INFO") {
      await notify({
        userId: app.createdById,
        event: "APPLICATION_RETURNED",
        title: `Application ${app.refNo} returned for information`,
        body: remarks ?? "Additional information is required. Please review and resubmit.",
        link: creatorLink,
      });
    } else if (to === "APPROVED" || to === "REJECTED") {
      await notify({
        userId: app.createdById,
        event: "DECISION_MADE",
        title: `Decision on ${app.refNo}: ${to === "APPROVED" ? "Approved" : "Rejected"}`,
        body:
          remarks ??
          (to === "APPROVED"
            ? "Your application has been approved. The height clearance certificate will follow."
            : "Your application has been rejected."),
        link: creatorLink,
      });
    } else if (to === "DECISION_PENDING") {
      const approvers = await prisma.user.findMany({
        where: { role: "APPROVER", active: true },
        select: { id: true },
      });
      await notifyMany(
        approvers.map((u) => u.id),
        {
          event: "REVIEW_COMPLETED",
          title: `Case ${app.refNo} awaits decision`,
          body: `${app.structureType} near ${app.airport.icao} — reviews complete, ready for final decision.`,
          link,
        }
      );
    } else if (to === "ENDORSED") {
      const intake = await prisma.user.findMany({
        where: { role: "INTAKE_OFFICER", active: true },
        select: { id: true },
      });
      await notifyMany(
        intake.map((u) => u.id),
        {
          event: "APPLICATION_ENDORSED",
          title: `Application ${app.refNo} endorsed to CAAB`,
          body: `${app.structureType} near ${app.airport.icao} is ready for intake scrutiny.`,
          link,
        }
      );
    } else if (to === "CERTIFICATE_ISSUED") {
      await notify({
        userId: app.createdById,
        event: "CERTIFICATE_ISSUED",
        title: `Certificate issued for ${app.refNo}`,
        body: "Your height clearance certificate has been issued.",
        link: creatorLink,
      });
    } else if (isCaabRole(user.role) && to === "STUDY") {
      const studyOfficers = await prisma.user.findMany({
        where: { role: "STUDY_OFFICER", active: true },
        select: { id: true },
      });
      await notifyMany(
        studyOfficers.map((u) => u.id),
        {
          event: "APPLICATION_ASSIGNED",
          title: `Case ${app.refNo} referred for aeronautical study`,
          body: remarks ?? `${app.structureType} near ${app.airport.icao} requires a study.`,
          link,
        }
      );
    }

    return Response.json({ application: updated });
  } catch (error) {
    return apiError(error);
  }
}
