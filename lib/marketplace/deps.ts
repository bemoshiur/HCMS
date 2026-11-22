import {
  GetEntitlementsCommand,
  MarketplaceEntitlementServiceClient,
} from '@aws-sdk/client-marketplace-entitlement-service';
import { MarketplaceMeteringClient, ResolveCustomerCommand } from '@aws-sdk/client-marketplace-metering';
import type { MarketplaceDeps } from './register';
import type { OnboardingDeps } from './onboarding';

/**
 * Production wiring. Both Marketplace APIs are served from us-east-1 whatever region
 * HCMS runs in; credentials come from the default chain (the Amplify SSR compute
 * role), never from an access-key env var. The role needs aws-marketplace:ResolveCustomer and
 * aws-marketplace:GetEntitlements, nothing else.
 *
 * Config is read from process.env lazily so importing this module (and the route)
 * never requires the listing to be configured.
 */
const REGION = 'us-east-1';
let metering: MarketplaceMeteringClient | undefined;
let entitlement: MarketplaceEntitlementServiceClient | undefined;

export function marketplaceConfig(): { productCode: string; eventsSecret: string | null; opsEmail: string } | null {
  const productCode = process.env.AWS_MP_PRODUCT_CODE?.trim();
  if (!productCode || !/^[a-z0-9]{10,40}$/.test(productCode)) return null;
  // Shared secret the EventBridge API destination sends; under 32 chars counts as unset.
  const secret = process.env.AWS_MP_EVENTS_SECRET?.trim() ?? '';
  const opsEmail = process.env.AWS_MP_OPS_EMAIL?.trim() || 'business@ticonsys.com';
  return { productCode, eventsSecret: secret.length >= 32 ? secret : null, opsEmail };
}

async function database() {
  return (await import('@/lib/db')).prisma;
}

export function marketplaceDeps(): MarketplaceDeps | null {
  const cfg = marketplaceConfig();
  if (!cfg) return null;
  return {
    productCode: cfg.productCode,
    now: () => new Date(),
    async resolveCustomer(token) {
      metering ??= new MarketplaceMeteringClient({ region: REGION });
      const out = await metering.send(new ResolveCustomerCommand({ RegistrationToken: token }));
      if (!out.LicenseArn || !out.ProductCode || !out.CustomerAWSAccountId) {
        throw new Error('ResolveCustomer returned no LicenseArn / account / product');
      }
      return {
        licenseArn: out.LicenseArn,
        customerAwsAccountId: out.CustomerAWSAccountId,
        productCode: out.ProductCode,
        customerIdentifier: out.CustomerIdentifier,
      };
    },
    async getEntitlements(code, licenseArn) {
      entitlement ??= new MarketplaceEntitlementServiceClient({ region: REGION });
      const all: { dimension?: string | undefined; expirationDate?: Date | undefined }[] = [];
      const pages: unknown[] = [];
      let nextToken: string | undefined;
      for (let page = 0; page < 10; page++) {
        const out = await entitlement.send(
          new GetEntitlementsCommand({
            ProductCode: code,
            Filter: { LICENSE_ARN: [licenseArn] },
            NextToken: nextToken,
          }),
        );
        pages.push(out.Entitlements ?? []);
        for (const e of out.Entitlements ?? []) all.push({ dimension: e.Dimension, expirationDate: e.ExpirationDate });
        nextToken = out.NextToken;
        if (!nextToken) break;
      }
      return { entitlements: all, raw: pages.flat() };
    },
    async upsertFromRegistration(l, hash, expires) {
      const { upsertFromRegistration } = await import('./store');
      return upsertFromRegistration(await database(), l, hash, expires);
    },
    async upsertFromEvent(l) {
      const { upsertFromEvent } = await import('./store');
      await upsertFromEvent(await database(), l);
    },
    async saveEntitlement(p, c, s) {
      const { saveEntitlement } = await import('./store');
      await saveEntitlement(await database(), p, c, s);
    },
    async setLicenseStatus(p, l, s) {
      const { setLicenseStatus } = await import('./store');
      await setLicenseStatus(await database(), p, l, s);
    },
    async setAgreementStatus(a, s) {
      const { setAgreementStatus } = await import('./store');
      return setAgreementStatus(await database(), a, s);
    },
  };
}

/** Null unless the listing and the EventBridge shared secret are both configured. */
export function eventsSecret(): string | null {
  return marketplaceConfig()?.eventsSecret ?? null;
}

export function onboardingDeps(): OnboardingDeps | null {
  const cfg = marketplaceConfig();
  if (!cfg) return null;
  return {
    now: () => new Date(),
    async claimOnboarding(hash, now, d) {
      const { claimOnboarding } = await import('./store');
      return claimOnboarding(await database(), hash, now, d);
    },
    async notifyTicon(record, d) {
      // HCMS has no outbound email in this build: tell every ADMIN in-app, and log
      // to CloudWatch (Amplify compute logs) so TiCON sees it even with no admin yet.
      const db = await database();
      const summary = [
        `AWS account ${record.customerAwsAccountId}`,
        `Dimension: ${record.entitlementDimension ?? 'none active'}`,
        `${d.organisationName} · ${d.contactName} <${d.contactEmail}>${d.contactPhone ? ` · ${d.contactPhone}` : ''} · ${d.country}`,
      ].join('\n');
      console.info(JSON.stringify({ event: 'aws_mp_onboarded', registration: record.id, ops: cfg.opsEmail, summary }));
      const admins = await db.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } });
      const { notifyMany } = await import('@/lib/notify');
      await notifyMany(
        admins.map((a) => a.id),
        { event: 'AWS_MARKETPLACE_ONBOARDED', title: `AWS Marketplace buyer: ${d.organisationName}`, body: summary, channels: ['IN_APP'] },
      );
    },
  };
}
