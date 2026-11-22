import type { Prisma, PrismaClient } from "@prisma/client";
import type { EntitlementSnapshot, LicenseStatus, ResolvedLicense } from "./register";
import type { OnboardingInput, OnboardingRecord } from "./onboarding";

/**
 * MarketplaceLicense reads and writes. Every write is conditional or keyed by the
 * (productCode, licenseArn) unique key, so retries and duplicate EventBridge
 * deliveries are idempotent.
 */
type Db = Pick<PrismaClient, "marketplaceLicense" | "$transaction">;

const key = (productCode: string, licenseArn: string) => ({
  productCode_licenseArn: { productCode, licenseArn },
});

export async function upsertFromRegistration(
  db: Db,
  l: ResolvedLicense,
  onboardingTokenHash: string,
  tokenExpiresAt: Date
): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const existing = await tx.marketplaceLicense.findUnique({
      where: key(l.productCode, l.licenseArn),
      select: { onboardingSubmittedAt: true },
    });
    // A buyer who returns before onboarding gets a fresh token; one who already
    // onboarded keeps the row's details and gets no new form.
    const onboarded = existing?.onboardingSubmittedAt != null;
    const row = await tx.marketplaceLicense.upsert({
      where: key(l.productCode, l.licenseArn),
      create: {
        licenseArn: l.licenseArn,
        customerAwsAccountId: l.customerAwsAccountId,
        customerIdentifier: l.customerIdentifier ?? null,
        productCode: l.productCode,
        onboardingTokenHash,
        onboardingTokenExpiresAt: tokenExpiresAt,
      },
      update: {
        customerAwsAccountId: l.customerAwsAccountId,
        ...(l.customerIdentifier ? { customerIdentifier: l.customerIdentifier } : {}),
        onboardingTokenHash: onboarded ? null : onboardingTokenHash,
        onboardingTokenExpiresAt: onboarded ? null : tokenExpiresAt,
      },
      select: { id: true },
    });
    return { id: row.id };
  });
}

export async function upsertFromEvent(
  db: Db,
  l: { licenseArn: string; customerAwsAccountId: string; productCode: string; agreementId: string | null }
): Promise<void> {
  await db.marketplaceLicense.upsert({
    where: key(l.productCode, l.licenseArn),
    create: {
      licenseArn: l.licenseArn,
      customerAwsAccountId: l.customerAwsAccountId,
      productCode: l.productCode,
      agreementId: l.agreementId,
    },
    update: l.agreementId ? { agreementId: l.agreementId } : {},
  });
}

export async function saveEntitlement(
  db: Db,
  productCode: string,
  licenseArn: string,
  snap: EntitlementSnapshot
): Promise<void> {
  await db.marketplaceLicense.updateMany({
    where: { productCode, licenseArn },
    data: {
      entitlementDimension: snap.dimension,
      entitlementExpiresAt: snap.expiresAt,
      entitlementRaw: (snap.raw ?? null) as Prisma.InputJsonValue,
      entitlementCheckedAt: new Date(),
    },
  });
}

export async function setLicenseStatus(
  db: Db,
  productCode: string,
  licenseArn: string,
  status: LicenseStatus
): Promise<void> {
  await db.marketplaceLicense.updateMany({ where: { productCode, licenseArn }, data: { subscriptionStatus: status } });
}

export async function setAgreementStatus(db: Db, agreementId: string, status: LicenseStatus): Promise<number> {
  const r = await db.marketplaceLicense.updateMany({ where: { agreementId }, data: { subscriptionStatus: status } });
  return r.count;
}

/** Single use: the conditional update clears the token in the same statement that stores the details. */
export async function claimOnboarding(
  db: Db,
  tokenHash: string,
  now: Date,
  d: Omit<OnboardingInput, "token">
): Promise<OnboardingRecord | null> {
  const row = await db.marketplaceLicense.findUnique({
    where: { onboardingTokenHash: tokenHash },
    select: { id: true, customerAwsAccountId: true, entitlementDimension: true },
  });
  if (!row) return null;
  const r = await db.marketplaceLicense.updateMany({
    where: {
      id: row.id,
      onboardingTokenHash: tokenHash,
      onboardingTokenExpiresAt: { gt: now },
      onboardingSubmittedAt: null,
    },
    data: {
      organisationName: d.organisationName,
      contactName: d.contactName,
      contactEmail: d.contactEmail,
      contactPhone: d.contactPhone ?? null,
      country: d.country,
      onboardingSubmittedAt: now,
      onboardingTokenHash: null,
      onboardingTokenExpiresAt: null,
    },
  });
  return r.count === 1 ? row : null;
}
