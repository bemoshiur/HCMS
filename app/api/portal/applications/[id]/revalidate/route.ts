// POST /api/portal/applications/[id]/revalidate — applicant requests
// revalidation of an issued/expired clearance. roleMayTransition enforces
// the legal CERTIFICATE_ISSUED/EXPIRED → REVALIDATION transitions.
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, apiError } from "@/lib/auth/guards";
import { roleMayTransition, slaDueDate } from "@/lib/workflow";
import { addCaseEvent, writeAudit } from "@/lib/audit";
import { notifyMany } from "@/lib/notify";

const bodySchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json ?? {});
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const remarks = parsed.data.remarks || null;

    const app = await prisma.application.findUnique({
      where: { id },
      select: {
        id: true,
        refNo: true,
        status: true,
        applicantOrgId: true,
        createdById: true,
        airport: { select: { icao: true } },
      },
    });
    if (!app) return Response.json({ error: "Application not found" }, { status: 404 });
    const owns = app.createdById === user.id || (!!user.orgId && app.applicantOrgId === user.orgId);
    if (!owns) return Response.json({ error: "Forbidden" }, { status: 403 });

    if (!roleMayTransition(user.role, app.status, "REVALIDATION")) {
      return Response.json(
        { error: `Revalidation cannot be requested while the case is ${app.status}` },
        { status: 409 }
      );
    }

    const now = new Date();
    const updated = await prisma.application.update({
      where: { id: app.id },
      data: { status: "REVALIDATION", slaDueAt: slaDueDate("REVALIDATION", now) },
      select: { id: true, refNo: true, status: true, slaDueAt: true },
    });

    await addCaseEvent({
      applicationId: app.id,
      type: "REVALIDATION",
      actorId: user.id,
      note: remarks ?? "Certificate revalidation requested by the applicant.",
    });
    await writeAudit({
      actorId: user.id,
      action: "application.revalidate",
      entity: "Application",
      entityId: app.id,
      before: { status: app.status },
      after: { status: "REVALIDATION", remarks },
    });

    const approvers = await prisma.user.findMany({
      where: { role: "APPROVER", active: true },
      select: { id: true },
    });
    await notifyMany(
      approvers.map((u) => u.id),
      {
        event: "APPLICATION_ASSIGNED",
        title: `Revalidation requested — ${app.refNo}`,
        body: `The applicant has requested revalidation of the height clearance for ${app.refNo} (${app.airport.icao}).`,
        link: `/applications/${app.id}`,
      }
    );

    return Response.json({ application: updated });
  } catch (error) {
    return apiError(error);
  }
}
