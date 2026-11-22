import { createHash, randomBytes } from 'node:crypto';
import { activeDimension, type Dimension, type EntitlementLike } from './dimensions';

/**
 * AWS Marketplace SaaS fulfillment for HCMS, as decision logic with its I/O
 * injected so it is testable without AWS or a database.
 *
 * Follows the integration AWS requires of SaaS products created after 1 June 2026
 * (Concurrent Agreements): a purchase is identified by its LicenseArn, not by
 * CustomerIdentifier, because one AWS account may hold several concurrent licenses
 * for the same product. ResolveCustomer returns LicenseArn + CustomerAWSAccountId;
 * GetEntitlements is filtered by LICENSE_ARN.
 *
 * HCMS is deployed per aviation authority, so a purchase does not create a tenant. It
 * records the license and hands the buyer's browser a one-time onboarding token so
 * they can leave the contact details TiCON needs to provision their environment.
 */

export interface ResolvedLicense {
  readonly licenseArn: string;
  readonly customerAwsAccountId: string;
  readonly productCode: string;
  /** Legacy identifier; AWS may still return it. Stored for reference only. */
  readonly customerIdentifier?: string | undefined;
}

export interface EntitlementSnapshot {
  readonly dimension: Dimension | null;
  readonly expiresAt: Date | null;
  readonly raw: unknown;
}

/** Our record of a license's lifecycle, driven by EventBridge license/agreement events. */
export type LicenseStatus = 'registered' | 'active' | 'deprovisioned' | 'agreement-ended';

export interface MarketplaceDeps {
  readonly productCode: string;
  readonly now: () => Date;
  resolveCustomer(token: string): Promise<ResolvedLicense>;
  getEntitlements(productCode: string, licenseArn: string): Promise<{ entitlements: EntitlementLike[]; raw: unknown }>;
  /** Insert or refresh the license from the fulfillment redirect, setting a new onboarding token hash. */
  upsertFromRegistration(l: ResolvedLicense, onboardingTokenHash: string, tokenExpiresAt: Date): Promise<{ id: string }>;
  /** Insert or refresh the license from an EventBridge event; never touches onboarding fields. */
  upsertFromEvent(l: {
    licenseArn: string;
    customerAwsAccountId: string;
    productCode: string;
    agreementId: string | null;
  }): Promise<void>;
  saveEntitlement(productCode: string, licenseArn: string, snap: EntitlementSnapshot): Promise<void>;
  setLicenseStatus(productCode: string, licenseArn: string, status: LicenseStatus): Promise<void>;
  /** Returns how many rows matched; agreement events carry no product code. */
  setAgreementStatus(agreementId: string, status: LicenseStatus): Promise<number>;
}

export type RegisterOutcome =
  | { readonly ok: true; readonly registrationId: string; readonly onboardingToken: string; readonly dimension: Dimension | null }
  | { readonly ok: false; readonly reason: 'missing_token' | 'wrong_product' | 'resolve_failed' };

const MAX_TOKEN_LENGTH = 4096;
export const ONBOARDING_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashOnboardingToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function registerFromToken(
  deps: MarketplaceDeps,
  token: string | null | undefined,
): Promise<RegisterOutcome> {
  const trimmed = token?.trim() ?? '';
  if (trimmed.length === 0 || trimmed.length > MAX_TOKEN_LENGTH) return { ok: false, reason: 'missing_token' };

  let license: ResolvedLicense;
  try {
    license = await deps.resolveCustomer(trimmed);
  } catch {
    // Expired, replayed or forged. AWS's error text is not shown to the buyer.
    return { ok: false, reason: 'resolve_failed' };
  }
  // A token for another TiCON listing must not register an HCMS buyer.
  if (license.productCode !== deps.productCode) return { ok: false, reason: 'wrong_product' };

  const onboardingToken = randomBytes(32).toString('base64url');
  const expires = new Date(deps.now().getTime() + ONBOARDING_TOKEN_TTL_MS);
  const { id } = await deps.upsertFromRegistration(license, hashOnboardingToken(onboardingToken), expires);
  const snap = await refreshEntitlement(deps, license.licenseArn);
  return { ok: true, registrationId: id, onboardingToken, dimension: snap.dimension };
}

export async function refreshEntitlement(deps: MarketplaceDeps, licenseArn: string): Promise<EntitlementSnapshot> {
  const { entitlements, raw } = await deps.getEntitlements(deps.productCode, licenseArn);
  const dimension = activeDimension(entitlements, deps.now());
  const expiresAt =
    dimension === null
      ? null
      : (entitlements
          .filter((e) => e.dimension === dimension && e.expirationDate)
          .map((e) => e.expirationDate as Date)
          .sort((a, b) => b.getTime() - a.getTime())
          .at(0) ?? null);
  const snap: EntitlementSnapshot = { dimension, expiresAt, raw };
  await deps.saveEntitlement(deps.productCode, licenseArn, snap);
  return snap;
}
