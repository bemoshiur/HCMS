import { timingSafeEqual } from 'node:crypto';
import { refreshEntitlement, type MarketplaceDeps } from './register';

/**
 * AWS Marketplace agreement and license events, delivered by an EventBridge rule
 * (source `aws.agreement-marketplace`, default bus, us-east-1, in TiCON's seller
 * account) to an API destination that POSTs the event to /api/aws/events.
 *
 * Authenticity: the API destination's connection sends a shared secret header; the
 * endpoint rejects anything without it. Even so, an event is only a hint — for
 * license events we re-read the truth from GetEntitlements, exactly as AWS requires.
 * Deliveries are at-least-once, so every handler is idempotent.
 */

export const EVENT_SOURCE = 'aws.agreement-marketplace';
export const LICENSE_UPDATED = 'License Updated - Manufacturer';
export const LICENSE_DEPROVISIONED = 'License Deprovisioned - Manufacturer';
export const AGREEMENT_ENDED = ['Purchase Agreement Ended - Proposer', 'Purchase Agreement Ended - Manufacturer'] as const;

export type EventOutcome =
  | 'license_refreshed'
  | 'license_deprovisioned'
  | 'agreement_ended'
  | 'agreement_unknown'
  | 'ignored_other_product'
  | 'ignored_event_type';

export class InvalidEventError extends Error {}

export function secretMatches(expected: string, given: string | undefined): boolean {
  if (!given || expected.length < 32) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(given, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function str(o: unknown, ...path: string[]): string | null {
  let cur: unknown = o;
  for (const k of path) {
    if (typeof cur !== 'object' || cur === null) return null;
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === 'string' && cur.length > 0 && cur.length <= 512 ? cur : null;
}

export async function handleMarketplaceEvent(deps: MarketplaceDeps, event: unknown): Promise<EventOutcome> {
  if (str(event, 'source') !== EVENT_SOURCE) throw new InvalidEventError('source');
  const type = str(event, 'detail-type');
  if (type === null) throw new InvalidEventError('detail-type');

  if ((AGREEMENT_ENDED as readonly string[]).includes(type)) {
    const agreementId = str(event, 'detail', 'agreement', 'id');
    if (agreementId === null) throw new InvalidEventError('agreement.id');
    // No product code on agreement events: only agreements we already recorded match.
    const n = await deps.setAgreementStatus(agreementId, 'agreement-ended');
    return n > 0 ? 'agreement_ended' : 'agreement_unknown';
  }

  if (type !== LICENSE_UPDATED && type !== LICENSE_DEPROVISIONED) return 'ignored_event_type';

  const productCode = str(event, 'detail', 'product', 'code');
  const licenseArn = str(event, 'detail', 'license', 'arn');
  const accountId = str(event, 'detail', 'acceptor', 'accountId');
  if (productCode === null || licenseArn === null || accountId === null) throw new InvalidEventError('license fields');
  if (productCode !== deps.productCode) return 'ignored_other_product';

  await deps.upsertFromEvent({
    licenseArn,
    customerAwsAccountId: accountId,
    productCode,
    agreementId: str(event, 'detail', 'agreement', 'id'),
  });
  // Entitlements are the source of truth either way; a deprovisioned license reads as none.
  const snap = await refreshEntitlement(deps, licenseArn);
  if (type === LICENSE_DEPROVISIONED) {
    await deps.setLicenseStatus(productCode, licenseArn, 'deprovisioned');
    return 'license_deprovisioned';
  }
  // Events can arrive out of order; the status follows the entitlement, not the event name.
  await deps.setLicenseStatus(productCode, licenseArn, snap.dimension ? 'active' : 'deprovisioned');
  return 'license_refreshed';
}
