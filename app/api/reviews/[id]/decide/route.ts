// POST /api/reviews/[id]/decide { verdict, overrideValueAmslM?, remarks? }
// Records the discipline verdict, then orchestrates the workflow:
//   REFER_STUDY          → application → STUDY + open a Study row + notify study officers
//   all disciplines done → application → DECISION_PENDING + notify approvers
// Guards: reviewer's own discipline only, review undecided, application UNDER_REVIEW.
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { reviewerDiscipline } from "@/lib/auth/permissions";
import { slaDueDate } from "@/lib/workflow";
import { addCaseEvent, writeAudit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notify";

const bodySchema = z
  .object({
    verdict: z.enum(["CONFIRM", "OVERRIDE", "REFER_STUDY"]),
    overrideValueAmslM: z.number().finite().positive().optional(),
    remarks: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.verdict === "OVERRIDE") {
      if (data.overrideValueAmslM == null) {
        ctx.addIssue({
          code: "custom",
          path: ["overrideValueAmslM"],
          message: "Override value (m AMSL) is required",
        });
      }
      if (!data.remarks) {
        ctx.addIssue({
          code: "custom",
          path: ["remarks"],
          message: "Remarks are required when overriding the automatic assessment",
        });
      }
    }
    if (data.verdict === "REFER_STUDY" && !data.remarks) {
      ctx.addIssue({
        code: "custom",
        path: ["remarks"],
        message: "Remarks are required when referring to an aeronautical study",
      });
    }
  });

const VERDICT_LABELS: Record<string, string> = {
  CONFIRM: "Confirmed automatic assessment",
  OVERRIDE: "Overrode automatic assessment",
  REFER_STUDY: "Referred to aeronautical study",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCapability("application.review");
    const discipline = reviewerDiscipline(user.role);
    if (!discipline) {
      return Response.json({ error: "No review discipline for this role" }, { status: 403 });
    }
    const { id } = await params;

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { verdict, overrideValueAmslM, remarks } = parsed.data;

    const review = await prisma.disciplineReview.findUnique({
      where: { id },
      include: {
        application: {
          select: {
            id: true,
            refNo: true,
            status: true,
            structureType: true,
            assignedDisciplines: true,
            assignedOfficerId: true,
            airport: { select: { icao: true } },
          },
        },
      },
    });
    if (!review) return Response.json({ error: "Review not found" }, { status: 404 });
    if (review.discipline !== discipline) {
      return Response.json(
        { error: "Forbidden: this review belongs to a different discipline" },
        { status: 403 }
      );
    }
    if (review.verdict !== null) {
      return Response.json({ error: "This review has already been decided" }, { status: 409 });
    }
    const app = review.application;
    if (app.status !== "UNDER_REVIEW") {
      return Response.json(
        { error: `The application is ${app.status}, not UNDER_REVIEW` },
        { status: 409 }
      );
    }

    const now = new Date();
    const updated = await prisma.disciplineReview.update({
      where: { id: review.id },
      data: {
        reviewerId: user.id,
        verdict,
        overrideValueAmslM: verdict === "OVERRIDE" ? overrideValueAmslM : null,
        remarks: remarks ?? null,
        decidedAt: now,
      },
    });

    await addCaseEvent({
      applicationId: app.id,
      type: "REVIEWED",
      actorId: user.id,
      note: `${discipline} review — ${VERDICT_LABELS[verdict]}${
        verdict === "OVERRIDE" && overrideValueAmslM != null
          ? ` (limiting value ${overrideValueAmslM.toFixed(2)} m AMSL)`
          : ""
      }${remarks ? `: ${remarks}` : ""}`,
      internal: true,
    });

    await writeAudit({
      actorId: user.id,
      action: "review.decide",
      entity: "DisciplineReview",
      entityId: review.id,
      before: { verdict: null },
      after: {
        discipline,
        verdict,
        overrideValueAmslM: verdict === "OVERRIDE" ? overrideValueAmslM : null,
        remarks: remarks ?? null,
      },
    });

    let applicationStatus = app.status as string;

    if (verdict === "REFER_STUDY") {
      // Open a study if none is already in progress on this case
      let study = await prisma.study.findFirst({
        where: { applicationId: app.id, outcome: null },
      });
      if (!study) {
        study = await prisma.study.create({
          data: { applicationId: app.id, type: "AERONAUTICAL" },
        });
      }

      await prisma.application.update({
        where: { id: app.id },
        data: { status: "STUDY", slaDueAt: slaDueDate("STUDY", now) },
      });
      applicationStatus = "STUDY";

      await addCaseEvent({
        applicationId: app.id,
        type: "STUDY_REFERRED",
        actorId: user.id,
        note: remarks ?? `Referred for aeronautical study by the ${discipline} reviewer.`,
      });

      await writeAudit({
        actorId: user.id,
        action: "application.transition",
        entity: "Application",
        entityId: app.id,
        before: { status: "UNDER_REVIEW" },
        after: { status: "STUDY", trigger: `review.${discipline}.REFER_STUDY` },
      });

      const studyOfficers = await prisma.user.findMany({
        where: { role: "STUDY_OFFICER", active: true },
        select: { id: true },
      });
      await notifyMany(
        studyOfficers.map((u) => u.id),
        {
          event: "APPLICATION_ASSIGNED",
          title: `Case ${app.refNo} referred for aeronautical study`,
          body:
            remarks ??
            `${app.structureType} near ${app.airport.icao} requires an aeronautical study.`,
          link: `/studies/${study.id}`,
        }
      );
    } else {
      // CONFIRM / OVERRIDE — advance the case once every assigned discipline is decided
      const reviews = await prisma.disciplineReview.findMany({
        where: { applicationId: app.id, discipline: { in: app.assignedDisciplines } },
        select: { discipline: true, verdict: true },
      });
      const allDecided =
        app.assignedDisciplines.length > 0 &&
        app.assignedDisciplines.every((d) => {
          const r = reviews.find((x) => x.discipline === d);
          return r?.verdict === "CONFIRM" || r?.verdict === "OVERRIDE";
        });

      if (allDecided) {
        await prisma.application.update({
          where: { id: app.id },
          data: { status: "DECISION_PENDING", slaDueAt: slaDueDate("DECISION_PENDING", now) },
        });
        applicationStatus = "DECISION_PENDING";

        await addCaseEvent({
          applicationId: app.id,
          type: "REVIEW_COMPLETE",
          actorId: user.id,
          note: `All assigned discipline reviews complete (${app.assignedDisciplines.join(
            ", "
          )}) — case ready for final decision.`,
          internal: true,
        });

        await writeAudit({
          actorId: user.id,
          action: "application.transition",
          entity: "Application",
          entityId: app.id,
          before: { status: "UNDER_REVIEW" },
          after: { status: "DECISION_PENDING", trigger: "reviews.complete" },
        });

        const approvers = await prisma.user.findMany({
          where: { role: "APPROVER", active: true },
          select: { id: true },
        });
        await notifyMany(
          approvers.map((u) => u.id),
          {
            event: "REVIEW_COMPLETED",
            title: `Case ${app.refNo} awaits decision`,
            body: `${app.structureType} near ${app.airport.icao} — all discipline reviews complete, ready for final decision.`,
            link: `/applications/${app.id}`,
          }
        );
      }
    }

    // Keep the assigned case officer in the loop on every discipline decision
    if (app.assignedOfficerId) {
      await notify({
        userId: app.assignedOfficerId,
        event: "REVIEW_COMPLETED",
        title: `${discipline} review decided on ${app.refNo}`,
        body: `${VERDICT_LABELS[verdict]}${remarks ? ` — ${remarks}` : ""}`,
        link: `/applications/${app.id}`,
      });
    }

    return Response.json({ review: updated, applicationStatus });
  } catch (error) {
    return apiError(error);
  }
}
