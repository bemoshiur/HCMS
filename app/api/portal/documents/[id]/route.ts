// GET /api/portal/documents/[id] — stream a stored document (inline).
// Access: the applicant org, its approving authority, or any CAAB role.
import { NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, apiError } from "@/lib/auth/guards";

const CAAB_ROLES: Role[] = [
  "INTAKE_OFFICER",
  "AGA_REVIEWER",
  "CNS_REVIEWER",
  "PANSOPS_REVIEWER",
  "APPROVER",
  "STUDY_OFFICER",
  "ADMIN",
  "AUDITOR",
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const doc = await prisma.documentFile.findUnique({
      where: { id },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        data: true,
        application: {
          select: { applicantOrgId: true, authorityOrgId: true, createdById: true },
        },
      },
    });
    if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });

    const app = doc.application;
    const allowed =
      CAAB_ROLES.includes(user.role) ||
      app.createdById === user.id ||
      (!!user.orgId &&
        (user.orgId === app.applicantOrgId || user.orgId === app.authorityOrgId));
    if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });

    if (!doc.data || doc.data.length === 0) {
      return Response.json({ error: "No stored content for this document" }, { status: 404 });
    }

    const filename = doc.filename.replace(/["\\\r\n]/g, "");
    return new Response(Buffer.from(doc.data), {
      headers: {
        "Content-Type": doc.mimeType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=0, no-cache",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
