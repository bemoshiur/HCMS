// Runs only against a Postgres that has the MarketplaceLicense migration applied:
//   TEST_DATABASE_URL=postgres://… pnpm test
import { afterAll, describe, expect, test } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  claimOnboarding,
  saveEntitlement,
  setAgreementStatus,
  setLicenseStatus,
  upsertFromEvent,
  upsertFromRegistration,
} from "./store";
import { hashOnboardingToken } from "./register";

const url = process.env.TEST_DATABASE_URL;
const db = url ? new PrismaClient({ datasources: { db: { url } } }) : null;

afterAll(async () => {
  await db?.$disconnect();
});

describe.skipIf(!url)("marketplace store (real Postgres)", () => {
  const run = `${Date.now()}`;
  const product = `p${run}abcdef`;
  const license = `arn:aws:license-manager::111122223333:license:l-${Date.now()}`;
  const customer = { licenseArn: license, customerAwsAccountId: "111122223333", productCode: product };
  const NOW = new Date();
  const LATER = new Date(NOW.getTime() + 86_400_000);
  const details = {
    organisationName: "Authority",
    contactName: "Ops",
    contactEmail: "ops@example.org",
    contactPhone: undefined,
    country: "Bangladesh",
  };

  test("upsert is idempotent per (product, license) and rotates the token", async () => {
    const a = await upsertFromRegistration(db!, customer, hashOnboardingToken(`first-token-aaaaaaaaaaaa-${run}`), LATER);
    const b = await upsertFromRegistration(db!, customer, hashOnboardingToken(`second-token-bbbbbbbbbbb-${run}`), LATER);
    expect(b.id).toBe(a.id);
    expect(await claimOnboarding(db!, hashOnboardingToken(`first-token-aaaaaaaaaaaa-${run}`), NOW, details)).toBeNull();
  });

  test("entitlement, agreement and status writes land on the row", async () => {
    await upsertFromEvent(db!, { ...customer, agreementId: `agmt-${run}` });
    await upsertFromEvent(db!, { ...customer, agreementId: null });
    await saveEntitlement(db!, product, license, { dimension: "enterprise", expiresAt: LATER, raw: [{ Dimension: "enterprise" }] });
    await setLicenseStatus(db!, product, license, "active");
    const row = await db!.marketplaceLicense.findUniqueOrThrow({
      where: { productCode_licenseArn: { productCode: product, licenseArn: license } },
    });
    expect(row).toMatchObject({ entitlementDimension: "enterprise", subscriptionStatus: "active", agreementId: `agmt-${run}` });
    expect(row.entitlementRaw).toEqual([{ Dimension: "enterprise" }]);
    expect(await setAgreementStatus(db!, `agmt-${run}`, "agreement-ended")).toBe(1);
    expect(await setAgreementStatus(db!, "agmt-missing", "agreement-ended")).toBe(0);
  });

  test("onboarding is single use and expiry is enforced", async () => {
    const hash = hashOnboardingToken(`second-token-bbbbbbbbbbb-${run}`);
    expect(await claimOnboarding(db!, hash, new Date(LATER.getTime() + 1), details)).toBeNull();
    const rec = await claimOnboarding(db!, hash, NOW, details);
    expect(rec).toMatchObject({ customerAwsAccountId: "111122223333", entitlementDimension: "enterprise" });
    expect(await claimOnboarding(db!, hash, NOW, details)).toBeNull();
    // A returning, already-onboarded buyer gets no new usable token.
    await upsertFromRegistration(db!, customer, hashOnboardingToken(`third-token-ccccccccccccc-${run}`), LATER);
    expect(await claimOnboarding(db!, hashOnboardingToken(`third-token-ccccccccccccc-${run}`), NOW, details)).toBeNull();
  });

  test("one account can hold two concurrent licenses as two rows", async () => {
    const a = await upsertFromRegistration(db!, { ...customer, licenseArn: `${license}-x` }, hashOnboardingToken(`x-${run}-xxxxxxxxxxxxxxxx`), LATER);
    const b = await upsertFromRegistration(db!, { ...customer, licenseArn: `${license}-y` }, hashOnboardingToken(`y-${run}-yyyyyyyyyyyyyyyy`), LATER);
    expect(a.id).not.toBe(b.id);
  });
});
