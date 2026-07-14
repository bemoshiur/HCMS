// POST /api/applications/[id]/message { note, internal?, escalate? }
// Adds a timeline note: external messages notify the case creator;
// internal notes and escalations stay inside CAAB.
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, apiError } from "@/lib/auth/guards";
import { addCaseEvent, writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { canViewApplication, isCaabRole } from "../../_lib/scope";

const bodySchema = z.object({
  note: z.string().trim().min(1, "Message is required").max(2000),
  internal: z.boolean().optional().default(false),
  escalate: z.boolean().optional().default(false),
});

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
    const { note, escalate } = parsed.data;
    const caab = isCaabRole(user.role);
    // Internal notes and escalations are CAAB-only; never trust the client flag
    const internal = (parsed.data.internal || escalate) && caab;
    if ((parsed.data.internal || escalate) && !caab) {
      return Response.json({ error: "Internal notes are restricted to CAAB officers" }, { status: 403 });
    }

    const app = await prisma.application.findUnique({
      where: { id },
      select: {
        id: true,
        refNo: true,
        applicantOrgId: true,
        authorityOrgId: true,
        createdById: true,
      },
    });
    if (!app) return Response.json({ error: "Application not found" }, { status: 404 });
    if (!canViewApplication(user, app)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await addCaseEvent({
      applicationId: app.id,
      type: escalate ? "ESCALATED" : internal ? "NOTE" : "MESSAGE",
      actorId: user.id,
      note,
      internal,
    });

    if (escalate) {
      await writeAudit({
        actorId: user.id,
        action: "application.escalate",
        entity: "Application",
        entityId: app.id,
        after: { note },
      });
    }

    // External messages from anyone but the creator notify the creator
    if (!internal && app.createdById !== user.id) {
      await notify({
        userId: app.createdById,
        event: "APPLICATION_RETURNED",
        title: `New message on ${app.refNo}`,
        body: note.length > 180 ? `${note.slice(0, 177)}…` : note,
        link: `/portal/applications/${app.id}`,
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
