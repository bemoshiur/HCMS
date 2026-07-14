// Certificate issue + lifecycle server helpers — shared by the certificate
// APIs and reusable from the applications module (approve → issue flow).
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { AuthError, type SessionUser } from "@/lib/auth/guards";
import { roleMayTransition } from "@/lib/workflow";
import { addCaseEvent, writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { nextHcNumber } from "@/lib/numbering";
import type { Certificate, Role } from "@prisma/client";

export const DEFAULT_VALIDITY_YEARS = 5;

/** Roles that may view any certificate (list page access + case officers). */
const STAFF_ROLES: Role[] = [
  "APPROVER",
  "ADMIN",
  "AUDITOR",
  "INTAKE_OFFICER",
  "AGA_REVIEWER",
  "CNS_REVIEWER",
  "PANSOPS_REVIEWER",
  "STUDY_OFFICER",
];

/** Throws 403 unless the user is staff or belongs to the application's parties. */
export function assertCertificateAccess(
  user: SessionUser,
  application: { createdById: string; applicantOrgId: string; authorityOrgId: string | null }
): void {
  if (STAFF_ROLES.includes(user.role)) return;
  if (application.createdById === user.id) return;
  if (
    user.orgId &&
    (user.orgId === application.applicantOrgId || user.orgId === application.authorityOrgId)
  ) {
    return;
  }
  throw new AuthError("Forbidden", 403);
}

function addYears(from: Date, years: number): Date {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

/** Standard conditions derived from the structure height + any study conditions. */
export function deriveConditions(
  requestedHeightAglM: number,
  studyConditions: string[] = []
): string[] {
  const conditions: string[] = [];
  if (requestedHeightAglM >= 45) {
    conditions.push(
      "The structure shall be fitted with low/medium-intensity obstacle light(s) at the top and at intermediate levels as applicable, operational from sunset to sunrise and during poor visibility, per ICAO Annex 14 Chapter 6."
    );
    conditions.push(
      "The structure shall carry conspicuous day marking (alternate aviation orange and white paint bands) maintained in good condition throughout its life."
    );
  }
  for (const c of studyConditions) {
    if (c && !conditions.includes(c)) conditions.push(c);
  }
  conditions.push(
    "No further vertical extension of the structure (including antennas, water tanks, lightning rods or any appurtenance) shall be made without a fresh height clearance from CAAB."
  );
  return conditions;
}

// ─────────────────────────────── Issue ───────────────────────────────

/**
 * Issue a GRANTED certificate for an APPROVED application:
 * creates the Certificate, transitions the application to CERTIFICATE_ISSUED,
 * records the case event + audit, notifies the applicant and registers a
 * COMPLIANT obstacle (source CERTIFIED).
 */
export async function issueCertificate(options: {
  actor: SessionUser;
  applicationId: string;
  validityYears?: number;
}): Promise<Certificate> {
  const { actor, applicationId } = options;
  const validityYears = options.validityYears ?? DEFAULT_VALIDITY_YEARS;

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      applicantOrg: { select: { name: true } },
      airport: { select: { id: true, icao: true, name: true } },
      evaluationResults: { orderBy: { computedAt: "desc" }, take: 1 },
      studies: { where: { outcome: "PERMIT_WITH_CONDITIONS" }, select: { proposedConditions: true } },
      certificates: { where: { status: "ISSUED" }, select: { id: true } },
    },
  });
  if (!application) throw new AuthError("Application not found", 404);
  if (application.status !== "APPROVED") {
    throw new AuthError("Only APPROVED applications can be issued a certificate", 409);
  }
  if (!roleMayTransition(actor.role, "APPROVED", "CERTIFICATE_ISSUED")) {
    throw new AuthError("Forbidden: your role may not issue certificates", 403);
  }
  const evaluation = application.evaluationResults[0];
  if (!evaluation) {
    throw new AuthError("Application has no evaluation result — run the OLS evaluation first", 409);
  }
  if (application.certificates.length > 0) {
    throw new AuthError("An active certificate already exists for this application", 409);
  }

  const now = new Date();
  const hcNo = await nextHcNumber(now);
  const qrToken = crypto.randomUUID();
  const conditions = deriveConditions(
    application.requestedHeightAglM,
    application.studies.flatMap((s) => s.proposedConditions)
  );

  const [certificate] = await prisma.$transaction([
    prisma.certificate.create({
      data: {
        hcNo,
        applicationId: application.id,
        decision: "GRANTED",
        ptE_amslM: evaluation.ptE_amslM ?? application.requestedTopElevationAmslM,
        permissibleAglM: evaluation.permissibleAglM ?? application.requestedHeightAglM,
        governingSurface: evaluation.governingSurface,
        conditions,
        validFrom: now,
        validTo: addYears(now, validityYears),
        qrToken,
        status: "ISSUED",
        signedById: actor.id,
      },
    }),
    prisma.application.update({
      where: { id: application.id },
      data: { status: "CERTIFICATE_ISSUED", slaDueAt: null, decidedAt: application.decidedAt ?? now },
    }),
    prisma.obstacle.create({
      data: {
        airportId: application.airportId,
        name: `${application.structureType} — ${application.applicantOrg.name}`,
        lat: application.lat,
        lon: application.lon,
        topElevationAmslM: application.requestedTopElevationAmslM,
        heightAglM: application.requestedHeightAglM,
        source: "CERTIFIED",
        structureType: application.structureType,
        status: "COMPLIANT",
        linkedApplicationId: application.id,
        remarks: `Certified under ${hcNo}`,
        lastCheckedAt: now,
      },
    }),
  ]);

  await addCaseEvent({
    applicationId: application.id,
    type: "CERTIFICATE_ISSUED",
    actorId: actor.id,
    note: `Height clearance certificate ${hcNo} issued (valid ${validityYears} years).`,
  });
  await writeAudit({
    actorId: actor.id,
    action: "certificate.issue",
    entity: "Certificate",
    entityId: certificate.id,
    after: {
      hcNo,
      applicationId: application.id,
      refNo: application.refNo,
      ptE_amslM: certificate.ptE_amslM,
      validTo: certificate.validTo,
    },
  });
  await notify({
    userId: application.createdById,
    event: "CERTIFICATE_ISSUED",
    title: `Certificate ${hcNo} issued`,
    body: `Height clearance certificate ${hcNo} has been issued for application ${application.refNo} (${application.airport.icao}).`,
    link: `/portal/applications/${application.id}`,
  });

  return certificate;
}

// ─────────────────────────────── Lifecycle ───────────────────────────────

export type LifecycleAction = "revoke" | "revalidate" | "supersede" | "expire";

export interface LifecycleResult {
  certificate: Certificate;
  /** Present only for supersede — the freshly issued replacement. */
  newCertificate?: Certificate;
}

/**
 * Apply a lifecycle action to a certificate; keeps the parent application
 * status in step, and writes case event + audit + notification.
 */
export async function applyCertificateLifecycle(options: {
  actor: SessionUser;
  certificateId: string;
  action: LifecycleAction;
  remarks?: string | null;
}): Promise<LifecycleResult> {
  const { actor, certificateId, action } = options;
  const remarks = options.remarks?.trim() || null;

  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: {
      application: {
        select: { id: true, refNo: true, status: true, createdById: true },
      },
    },
  });
  if (!certificate) throw new AuthError("Certificate not found", 404);

  const application = certificate.application;
  const now = new Date();
  const before = { status: certificate.status, validFrom: certificate.validFrom, validTo: certificate.validTo };

  const note = remarks ? ` Remarks: ${remarks}` : "";

  if (action === "revoke") {
    if (certificate.status !== "ISSUED") {
      throw new AuthError("Only an ISSUED certificate can be revoked", 409);
    }
    if (!roleMayTransition(actor.role, application.status, "REVOKED")) {
      throw new AuthError("Forbidden: your role may not revoke this certificate", 403);
    }
    const [updated] = await prisma.$transaction([
      prisma.certificate.update({ where: { id: certificate.id }, data: { status: "REVOKED" } }),
      prisma.application.update({
        where: { id: application.id },
        data: { status: "REVOKED", slaDueAt: null },
      }),
    ]);
    await addCaseEvent({
      applicationId: application.id,
      type: "CERTIFICATE_REVOKED",
      actorId: actor.id,
      note: `Certificate ${certificate.hcNo} revoked.${note}`,
    });
    await writeAudit({
      actorId: actor.id,
      action: "certificate.revoke",
      entity: "Certificate",
      entityId: certificate.id,
      before,
      after: { status: "REVOKED", remarks },
    });
    await notify({
      userId: application.createdById,
      event: "CERTIFICATE_REVOKED",
      title: `Certificate ${certificate.hcNo} revoked`,
      body: `Certificate ${certificate.hcNo} for application ${application.refNo} has been revoked.${note}`,
      link: `/portal/applications/${application.id}`,
    });
    return { certificate: updated };
  }

  if (action === "expire") {
    if (certificate.status !== "ISSUED") {
      throw new AuthError("Only an ISSUED certificate can be marked expired", 409);
    }
    if (!roleMayTransition(actor.role, application.status, "EXPIRED")) {
      throw new AuthError("Forbidden: your role may not expire this certificate", 403);
    }
    const [updated] = await prisma.$transaction([
      prisma.certificate.update({ where: { id: certificate.id }, data: { status: "EXPIRED" } }),
      prisma.application.update({
        where: { id: application.id },
        data: { status: "EXPIRED", slaDueAt: null },
      }),
    ]);
    await addCaseEvent({
      applicationId: application.id,
      type: "CERTIFICATE_EXPIRED",
      actorId: actor.id,
      note: `Certificate ${certificate.hcNo} marked expired.${note}`,
    });
    await writeAudit({
      actorId: actor.id,
      action: "certificate.expire",
      entity: "Certificate",
      entityId: certificate.id,
      before,
      after: { status: "EXPIRED", remarks },
    });
    await notify({
      userId: application.createdById,
      event: "CERTIFICATE_EXPIRING",
      title: `Certificate ${certificate.hcNo} expired`,
      body: `Certificate ${certificate.hcNo} for application ${application.refNo} has expired. You may request revalidation.`,
      link: `/portal/applications/${application.id}`,
    });
    return { certificate: updated };
  }

  if (action === "revalidate") {
    if (certificate.status !== "ISSUED" && certificate.status !== "EXPIRED") {
      throw new AuthError("Only an ISSUED or EXPIRED certificate can be revalidated", 409);
    }
    const [updated] = await prisma.$transaction([
      prisma.certificate.update({
        where: { id: certificate.id },
        data: {
          status: "ISSUED",
          validFrom: now,
          validTo: addYears(now, DEFAULT_VALIDITY_YEARS),
        },
      }),
      prisma.application.update({
        where: { id: application.id },
        data: { status: "CERTIFICATE_ISSUED", slaDueAt: null },
      }),
    ]);
    await addCaseEvent({
      applicationId: application.id,
      type: "CERTIFICATE_REVALIDATED",
      actorId: actor.id,
      note: `Certificate ${certificate.hcNo} revalidated to ${updated.validTo.toISOString().slice(0, 10)}.${note}`,
    });
    await writeAudit({
      actorId: actor.id,
      action: "certificate.revalidate",
      entity: "Certificate",
      entityId: certificate.id,
      before,
      after: { status: "ISSUED", validFrom: updated.validFrom, validTo: updated.validTo, remarks },
    });
    await notify({
      userId: application.createdById,
      event: "CERTIFICATE_ISSUED",
      title: `Certificate ${certificate.hcNo} revalidated`,
      body: `Certificate ${certificate.hcNo} for application ${application.refNo} has been revalidated for ${DEFAULT_VALIDITY_YEARS} more years.`,
      link: `/portal/applications/${application.id}`,
    });
    return { certificate: updated };
  }

  // supersede
  if (certificate.status !== "ISSUED") {
    throw new AuthError("Only an ISSUED certificate can be superseded", 409);
  }
  const hcNo = await nextHcNumber(now);
  const { newCertificate, updated } = await prisma.$transaction(async (tx) => {
    const created = await tx.certificate.create({
      data: {
        hcNo,
        applicationId: application.id,
        decision: "GRANTED",
        ptE_amslM: certificate.ptE_amslM,
        permissibleAglM: certificate.permissibleAglM,
        governingSurface: certificate.governingSurface,
        conditions: certificate.conditions,
        validFrom: now,
        validTo: addYears(now, DEFAULT_VALIDITY_YEARS),
        qrToken: crypto.randomUUID(),
        status: "ISSUED",
        signedById: actor.id,
      },
    });
    const old = await tx.certificate.update({
      where: { id: certificate.id },
      data: { status: "SUPERSEDED", supersededById: created.id },
    });
    return { newCertificate: created, updated: old };
  });
  await addCaseEvent({
    applicationId: application.id,
    type: "CERTIFICATE_SUPERSEDED",
    actorId: actor.id,
    note: `Certificate ${certificate.hcNo} superseded by ${hcNo}.${note}`,
  });
  await writeAudit({
    actorId: actor.id,
    action: "certificate.supersede",
    entity: "Certificate",
    entityId: certificate.id,
    before,
    after: { status: "SUPERSEDED", supersededById: newCertificate.id, newHcNo: hcNo, remarks },
  });
  await notify({
    userId: application.createdById,
    event: "CERTIFICATE_ISSUED",
    title: `Certificate ${certificate.hcNo} superseded`,
    body: `Certificate ${certificate.hcNo} has been superseded by ${hcNo} for application ${application.refNo}.`,
    link: `/portal/applications/${application.id}`,
  });
  return { certificate: updated, newCertificate };
}
