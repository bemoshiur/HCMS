// Audit trail — every state change and admin action is recorded (§17).
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function writeAudit(options: {
  actorId?: string | null;
  action: string; // e.g. "application.transition", "masterdata.update"
  entity: string; // e.g. "Application"
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: options.actorId ?? null,
        action: options.action,
        entity: options.entity,
        entityId: options.entityId ?? null,
        before: (options.before as Prisma.InputJsonValue) ?? undefined,
        after: (options.after as Prisma.InputJsonValue) ?? undefined,
        ip: options.ip ?? null,
      },
    });
  } catch (error) {
    // Audit failures must never break the main operation, but are loud in logs
    console.error("AUDIT WRITE FAILED", options.action, error);
  }
}

export async function addCaseEvent(options: {
  applicationId: string;
  type: string; // SUBMITTED | ENDORSED | ASSIGNED | REVIEWED | MESSAGE | NOTE | DECISION | ...
  actorId?: string | null;
  note?: string | null;
  internal?: boolean;
}): Promise<void> {
  await prisma.caseEvent.create({
    data: {
      applicationId: options.applicationId,
      type: options.type,
      actorId: options.actorId ?? null,
      note: options.note ?? null,
      internal: options.internal ?? false,
    },
  });
}
