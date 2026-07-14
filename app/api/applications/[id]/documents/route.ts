// GET /api/applications/[id]/documents — typed, versioned document list.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, apiError } from "@/lib/auth/guards";
import { canViewApplication } from "../../_lib/scope";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const app = await prisma.application.findUnique({
      where: { id },
      select: { id: true, applicantOrgId: true, authorityOrgId: true, createdById: true },
    });
    if (!app) return Response.json({ error: "Application not found" }, { status: 404 });
    if (!canViewApplication(user, app)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const documents = await prisma.documentFile.findMany({
      where: { applicationId: app.id },
      orderBy: [{ type: "asc" }, { version: "desc" }, { uploadedAt: "desc" }],
      select: {
        id: true,
        type: true,
        filename: true,
        url: true,
        sizeBytes: true,
        mimeType: true,
        version: true,
        uploadedAt: true,
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    return Response.json({ documents });
  } catch (error) {
    return apiError(error);
  }
}
