// POST /api/portal/documents — multipart upload (file, type, applicationId).
// Bytes are stored in DocumentFile.data (serverless-safe demo storage); the
// record's url points at GET /api/portal/documents/[id].
import { NextRequest } from "next/server";
import type { DocumentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES: DocumentType[] = [
  "OWNERSHIP",
  "SITE_PLAN",
  "ELEVATION_CERT",
  "MOUZA_MAP",
  "OTHER",
];
const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg"];
const UPLOADABLE_STATUSES = ["DRAFT", "RETURNED_FOR_INFO"];

export async function POST(request: NextRequest) {
  try {
    const user = await requireCapability("application.create");

    const form = await request.formData().catch(() => null);
    if (!form) return Response.json({ error: "Expected multipart form data" }, { status: 400 });

    const file = form.get("file");
    const type = String(form.get("type") ?? "");
    const applicationId = String(form.get("applicationId") ?? "");

    if (!(file instanceof File)) {
      return Response.json({ error: "A file is required" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(type as DocumentType)) {
      return Response.json(
        { error: `Invalid document type — expected one of ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!applicationId) {
      return Response.json({ error: "applicationId is required" }, { status: 400 });
    }
    if (file.size === 0) {
      return Response.json({ error: "The file is empty" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "File exceeds the 5 MB limit" }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return Response.json(
        { error: "Only PDF, PNG and JPEG files are accepted" },
        { status: 400 }
      );
    }

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, refNo: true, status: true, applicantOrgId: true, createdById: true },
    });
    if (!app) return Response.json({ error: "Application not found" }, { status: 404 });
    const owns = app.createdById === user.id || (!!user.orgId && app.applicantOrgId === user.orgId);
    if (!owns) return Response.json({ error: "Forbidden" }, { status: 403 });
    if (!UPLOADABLE_STATUSES.includes(app.status)) {
      return Response.json(
        { error: "Documents can only be uploaded while the application is in draft or returned for information" },
        { status: 409 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const existing = await prisma.documentFile.count({
      where: { applicationId: app.id, type: type as DocumentType },
    });

    const created = await prisma.documentFile.create({
      data: {
        applicationId: app.id,
        type: type as DocumentType,
        filename: file.name || `${type.toLowerCase()}.pdf`,
        url: "", // set below once the id exists
        data: bytes,
        sizeBytes: file.size,
        mimeType: file.type,
        version: existing + 1,
        uploadedById: user.id,
      },
    });
    const document = await prisma.documentFile.update({
      where: { id: created.id },
      data: { url: `/api/portal/documents/${created.id}` },
      select: {
        id: true,
        type: true,
        filename: true,
        url: true,
        sizeBytes: true,
        mimeType: true,
        version: true,
        uploadedAt: true,
      },
    });

    await writeAudit({
      actorId: user.id,
      action: "document.upload",
      entity: "DocumentFile",
      entityId: document.id,
      after: {
        applicationId: app.id,
        refNo: app.refNo,
        type: document.type,
        filename: document.filename,
        sizeBytes: document.sizeBytes,
        version: document.version,
      },
    });

    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
