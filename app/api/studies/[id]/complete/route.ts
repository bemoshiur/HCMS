// POST /api/studies/[id]/complete { type, findings, proposedConditions, outcome }
// Concludes the study and advances the application STUDY → DECISION_PENDING.
// The approver sees the outcome on the case; PERMIT_WITH_CONDITIONS conditions
// are merged into the certificate by the certificate module on issue.
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { slaDueDate } from "@/lib/workflow";
import { addCaseEvent, writeAudit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notify";

const bodySchema = z
  .object({
    type: z.enum(["AERONAUTICAL", "SHIELDING"]),
    findings: z
      .string()
      .trim()
      .min(30, "Findings must be at least 30 characters")
      .max(10000),
    proposedConditions: z.array(z.string().trim().min(1).max(300)).max(20),
    outcome: z.enum(["PERMIT_WITH_CONDITIONS", "REFUSE"]),
  })
  .superRefine((data, ctx) => {
    if (data.outcome === "PERMIT_WITH_CONDITIONS" && data.proposedConditions.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["proposedConditions"],
        message: "At least one condition is required for a conditional permit",
      });
    }
  });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCapability("application.study");
    const { id } = await params;

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { type, findings, proposedConditions, outcome } = parsed.data;

    const study = await prisma.study.findUnique({
      where: { id },
      include: {
        application: {
          select: {
            id: true,
            refNo: true,
            status: true,
            structureType: true,
            assignedOfficerId: true,
            airport: { select: { icao: true } },
          },
        },
      },
    });
    if (!study) return Response.json({ error: "Study not found" }, { status: 404 });
    if (study.outcome !== null) {
      return Response.json({ error: "This study is already completed" }, { status: 409 });
    }
    const app = study.application;
    if (app.status !== "STUDY") {
      return Response.json(
        { error: `The application is ${app.status}, not STUDY` },
        { status: 409 }
      );
    }

    const now = new Date();
    const outcomeLabel =
      outcome === "PERMIT_WITH_CONDITIONS" ? "Permit with conditions" : "Refuse";

    const updated = await prisma.study.update({
      where: { id: study.id },
      data: {
        type,
        findings,
        proposedConditions,
        outcome,
        officerId: user.id,
        decidedAt: now,
      },
    });

    await prisma.application.update({
      where: { id: app.id },
      data: { status: "DECISION_PENDING", slaDueAt: slaDueDate("DECISION_PENDING", now) },
    });

    await addCaseEvent({
      applicationId: app.id,
      type: "STUDY_COMPLETE",
      actorId: user.id,
      note: `${type === "AERONAUTICAL" ? "Aeronautical study" : "Shielding assessment"} complete — outcome: ${outcomeLabel}${
        proposedConditions.length
          ? ` (${proposedConditions.length} proposed condition${proposedConditions.length === 1 ? "" : "s"})`
          : ""
      }. Case ready for final decision.`,
      internal: true,
    });

    await writeAudit({
      actorId: user.id,
      action: "study.complete",
      entity: "Study",
      entityId: study.id,
      before: { outcome: null, status: "STUDY" },
      after: { type, outcome, proposedConditions, applicationStatus: "DECISION_PENDING" },
    });

    const approvers = await prisma.user.findMany({
      where: { role: "APPROVER", active: true },
      select: { id: true },
    });
    await notifyMany(
      approvers.map((u) => u.id),
      {
        event: "STUDY_COMPLETED",
        title: `Study complete on ${app.refNo} — ${outcomeLabel}`,
        body: `${app.structureType} near ${app.airport.icao} — the study recommends ${outcomeLabel.toLowerCase()}. Case awaits your decision.`,
        link: `/applications/${app.id}`,
      }
    );
    if (app.assignedOfficerId) {
      await notify({
        userId: app.assignedOfficerId,
        event: "STUDY_COMPLETED",
        title: `Study complete on ${app.refNo}`,
        body: `Outcome: ${outcomeLabel}. The case has moved to Decision Pending.`,
        link: `/applications/${app.id}`,
      });
    }

    return Response.json({ study: updated, applicationStatus: "DECISION_PENDING" });
  } catch (error) {
    return apiError(error);
  }
}
