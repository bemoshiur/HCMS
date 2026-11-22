import { describe, expect, test } from 'vitest';
import { activeDimension } from './dimensions';
import {
  hashOnboardingToken,
  registerFromToken,
  type EntitlementSnapshot,
  type LicenseStatus,
  type MarketplaceDeps,
} from './register';
import { handleMarketplaceEvent, InvalidEventError, secretMatches } from './events';
import { submitOnboarding, type OnboardingDeps } from './onboarding';
import { EVENTS_SECRET_HEADER, handleEvents, handleOnboarding, handleRegister } from './http';

const NOW = new Date('2026-11-22T12:00:00Z');
const NEXT_YEAR = new Date('2027-11-22T12:00:00Z');
const LAST_YEAR = new Date('2025-11-22T12:00:00Z');
const PRODUCT = 'nibandhaktestcode01';

const LICENSE = 'arn:aws:license-manager::111122223333:license:l-0123456789abcdef0123456789abcdef';

function fakeDeps(over: Partial<MarketplaceDeps> = {}) {
  const calls = {
    registrations: [] as { licenseArn: string; hash: string; expires: Date }[],
    eventUpserts: [] as { licenseArn: string; agreementId: string | null }[],
    entitlementQueries: [] as string[],
    snaps: [] as EntitlementSnapshot[],
    statuses: [] as LicenseStatus[],
    agreements: [] as string[],
  };
  const deps: MarketplaceDeps = {
    productCode: PRODUCT,
    now: () => NOW,
    resolveCustomer: async () => ({ licenseArn: LICENSE, customerAwsAccountId: '111122223333', productCode: PRODUCT }),
    getEntitlements: async (_p, arn) => {
      calls.entitlementQueries.push(arn);
      return { entitlements: [{ dimension: 'professional', expirationDate: NEXT_YEAR }], raw: [{ Dimension: 'professional' }] };
    },
    upsertFromRegistration: async (l, hash, expires) => {
      calls.registrations.push({ licenseArn: l.licenseArn, hash, expires });
      return { id: 'reg-1' };
    },
    upsertFromEvent: async (l) => {
      calls.eventUpserts.push({ licenseArn: l.licenseArn, agreementId: l.agreementId });
    },
    saveEntitlement: async (_p, _l, s) => {
      calls.snaps.push(s);
    },
    setLicenseStatus: async (_p, _l, s) => {
      calls.statuses.push(s);
    },
    setAgreementStatus: async (a) => {
      calls.agreements.push(a);
      return a === 'agmt-known' ? 1 : 0;
    },
    ...over,
  };
  return { deps, calls };
}

describe('activeDimension', () => {
  test('highest unexpired known dimension wins', () => {
    expect(
      activeDimension(
        [
          { dimension: 'standard', expirationDate: NEXT_YEAR },
          { dimension: 'enterprise', expirationDate: LAST_YEAR },
          { dimension: 'professional' },
          { dimension: 'something-else', expirationDate: NEXT_YEAR },
        ],
        NOW,
      ),
    ).toBe('professional');
  });
  test('nothing live is null', () => {
    expect(activeDimension([{ dimension: 'enterprise', expirationDate: LAST_YEAR }], NOW)).toBeNull();
    expect(activeDimension([], NOW)).toBeNull();
  });
});

describe('registerFromToken', () => {
  test('resolves, stores a token hash, never the token, and reads the entitlement', async () => {
    const { deps, calls } = fakeDeps();
    const out = await registerFromToken(deps, '  token-abc  ');
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.dimension).toBe('professional');
    expect(out.onboardingToken.length).toBeGreaterThanOrEqual(40);
    expect(calls.registrations[0]!.licenseArn).toBe(LICENSE);
    expect(calls.registrations[0]!.hash).toBe(hashOnboardingToken(out.onboardingToken));
    expect(calls.registrations[0]!.hash).not.toContain(out.onboardingToken);
    expect(calls.registrations[0]!.expires.getTime()).toBe(NOW.getTime() + 7 * 24 * 3600 * 1000);
    expect(calls.entitlementQueries).toEqual([LICENSE]);
    expect(calls.snaps[0]).toMatchObject({ dimension: 'professional', expiresAt: NEXT_YEAR });
  });
  test('missing or oversized token never calls AWS', async () => {
    let called = false;
    const { deps } = fakeDeps({ resolveCustomer: async () => ((called = true), Promise.reject(new Error('x'))) });
    expect(await registerFromToken(deps, '')).toEqual({ ok: false, reason: 'missing_token' });
    expect(await registerFromToken(deps, 'a'.repeat(5000))).toEqual({ ok: false, reason: 'missing_token' });
    expect(called).toBe(false);
  });
  test('AWS rejection and another product are refused without writes', async () => {
    const rejected = fakeDeps({ resolveCustomer: async () => Promise.reject(new Error('InvalidTokenException')) });
    expect(await registerFromToken(rejected.deps, 't')).toEqual({ ok: false, reason: 'resolve_failed' });
    const other = fakeDeps({
      resolveCustomer: async () => ({ licenseArn: 'arn:other', customerAwsAccountId: '1', productCode: 'otherproduct000' }),
    });
    expect(await registerFromToken(other.deps, 't')).toEqual({ ok: false, reason: 'wrong_product' });
    expect(rejected.calls.registrations.length + other.calls.registrations.length).toBe(0);
  });
});

function licenseEvent(type: string, productCode = PRODUCT) {
  return {
    version: '0',
    'detail-type': type,
    source: 'aws.agreement-marketplace',
    region: 'us-east-1',
    detail: {
      agreement: { id: 'agmt-abc' },
      product: { code: productCode, id: 'prod-zrfftunbrvpji' },
      license: { arn: LICENSE },
      acceptor: { accountId: '111122223333' },
      proposer: { accountId: '542374379351' },
    },
  };
}

describe('handleMarketplaceEvent', () => {
  test('License Updated records the license, re-reads entitlements by LicenseArn, marks active', async () => {
    const { deps, calls } = fakeDeps();
    expect(await handleMarketplaceEvent(deps, licenseEvent('License Updated - Manufacturer'))).toBe('license_refreshed');
    expect(calls.eventUpserts).toEqual([{ licenseArn: LICENSE, agreementId: 'agmt-abc' }]);
    expect(calls.entitlementQueries).toEqual([LICENSE]);
    expect(calls.statuses).toEqual(['active']);
  });
  test('a late License Updated with no live entitlement does not resurrect the license', async () => {
    const { deps, calls } = fakeDeps({ getEntitlements: async () => ({ entitlements: [], raw: [] }) });
    await handleMarketplaceEvent(deps, licenseEvent('License Updated - Manufacturer'));
    expect(calls.statuses).toEqual(['deprovisioned']);
  });
  test('License Deprovisioned marks the license deprovisioned', async () => {
    const { deps, calls } = fakeDeps();
    expect(await handleMarketplaceEvent(deps, licenseEvent('License Deprovisioned - Manufacturer'))).toBe('license_deprovisioned');
    expect(calls.statuses).toEqual(['deprovisioned']);
  });
  test('agreement ended matches only recorded agreements', async () => {
    const { deps, calls } = fakeDeps();
    const ended = (id: string) => ({
      source: 'aws.agreement-marketplace',
      'detail-type': 'Purchase Agreement Ended - Proposer',
      detail: { agreement: { id, status: 'CANCELLED' } },
    });
    expect(await handleMarketplaceEvent(deps, ended('agmt-known'))).toBe('agreement_ended');
    expect(await handleMarketplaceEvent(deps, ended('agmt-other'))).toBe('agreement_unknown');
    expect(calls.agreements).toEqual(['agmt-known', 'agmt-other']);
  });
  test('other products and other event types are ignored without writes', async () => {
    const { deps, calls } = fakeDeps();
    expect(await handleMarketplaceEvent(deps, licenseEvent('License Updated - Manufacturer', 'otherproduct000'))).toBe(
      'ignored_other_product',
    );
    expect(await handleMarketplaceEvent(deps, { ...licenseEvent('Offer Released'), source: 'aws.agreement-marketplace' })).toBe(
      'ignored_event_type',
    );
    expect(calls.eventUpserts.length + calls.statuses.length).toBe(0);
  });
  test('wrong source or missing fields are invalid', async () => {
    const { deps } = fakeDeps();
    await expect(handleMarketplaceEvent(deps, { ...licenseEvent('License Updated - Manufacturer'), source: 'evil' })).rejects.toBeInstanceOf(
      InvalidEventError,
    );
    const broken = licenseEvent('License Updated - Manufacturer');
    (broken.detail as Record<string, unknown>).license = {};
    await expect(handleMarketplaceEvent(deps, broken)).rejects.toBeInstanceOf(InvalidEventError);
  });
  test('secretMatches is exact and refuses short secrets', () => {
    const s = 'k'.repeat(40);
    expect(secretMatches(s, s)).toBe(true);
    expect(secretMatches(s, `${s}x`)).toBe(false);
    expect(secretMatches(s, undefined)).toBe(false);
    expect(secretMatches('short', 'short')).toBe(false);
  });
});

const TOKEN = 'x'.repeat(43);
const VALID = {
  token: TOKEN,
  organisationName: 'Postal Regulatory Office',
  contactName: 'A. Rahman',
  contactEmail: 'Ops@Example.org',
  contactPhone: '+880 1700-000000',
  country: 'Bangladesh',
};

function onboarding(over: Partial<OnboardingDeps> = {}) {
  const seen: { hash: string; email: string }[] = [];
  let notified = 0;
  const deps: OnboardingDeps = {
    now: () => NOW,
    claimOnboarding: async (hash, _now, d) => {
      seen.push({ hash, email: d.contactEmail });
      return hash === hashOnboardingToken(TOKEN) ? { id: 'reg-1', customerAwsAccountId: '1', entitlementDimension: 'standard' } : null;
    },
    notifyTicon: async () => {
      notified++;
    },
    ...over,
  };
  return { deps, seen, notified: () => notified };
}

describe('submitOnboarding', () => {
  test('stores normalised details against the token hash and notifies TiCON', async () => {
    const o = onboarding();
    const out = await submitOnboarding(o.deps, VALID);
    expect(out.ok).toBe(true);
    expect(o.seen).toEqual([{ hash: hashOnboardingToken(TOKEN), email: 'ops@example.org' }]);
    expect(o.notified()).toBe(1);
  });
  test('bad input never reaches the database; unknown token is refused', async () => {
    const o = onboarding();
    expect(await submitOnboarding(o.deps, { ...VALID, contactEmail: 'not-an-email' })).toEqual({ ok: false, reason: 'invalid_input' });
    expect(o.seen).toHaveLength(0);
    expect(await submitOnboarding(o.deps, { ...VALID, token: 'y'.repeat(43) })).toEqual({ ok: false, reason: 'invalid_or_used_token' });
  });
  test('a failed notification does not fail the buyer', async () => {
    const o = onboarding({ notifyTicon: async () => Promise.reject(new Error('smtp down')) });
    expect((await submitOnboarding(o.deps, VALID)).ok).toBe(true);
  });
});

const SECRET = 's'.repeat(48);

describe('http handlers', () => {
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };
  const post = (body: BodyInit, headers: Record<string, string> = {}) =>
    new Request('https://hcms.ticonsys.com/api/aws/x', { method: 'POST', body, headers });

  test('unconfigured listing answers 404 everywhere', async () => {
    expect((await handleRegister(post(form({})), null)).status).toBe(404);
    expect((await handleEvents(post('{}'), null, null)).status).toBe(404);
    expect((await handleEvents(post('{}'), fakeDeps().deps, null)).status).toBe(404);
    expect((await handleOnboarding(post(form({})), null)).status).toBe(404);
  });
  test('register redirects with the token only in the fragment', async () => {
    const res = await handleRegister(post(form({ 'x-amzn-marketplace-token': 'tok' })), fakeDeps().deps);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toMatch(/^\/aws\/welcome#t=[A-Za-z0-9_-]{40,}$/);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
  test('register without a token shows the bilingual failure page', async () => {
    const res = await handleRegister(post(form({})), fakeDeps().deps);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain('AWS Marketplace');
    expect(html).toContain('নিশ্চিত');
  });
  test('events require the shared secret, then accept a license event', async () => {
    const body = JSON.stringify(licenseEvent('License Updated - Manufacturer'));
    const { deps } = fakeDeps();
    expect((await handleEvents(post(body), deps, SECRET)).status).toBe(401);
    expect((await handleEvents(post(body, { [EVENTS_SECRET_HEADER]: 'nope' }), deps, SECRET)).status).toBe(401);
    const ok = await handleEvents(post(body, { [EVENTS_SECRET_HEADER]: SECRET }), deps, SECRET);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, result: 'license_refreshed' });
  });
  test('events reject non-JSON and malformed events with 400', async () => {
    const h = { [EVENTS_SECRET_HEADER]: SECRET };
    const { deps } = fakeDeps();
    expect((await handleEvents(post('nope', h), deps, SECRET)).status).toBe(400);
    expect((await handleEvents(post(JSON.stringify({ source: 'x' }), h), deps, SECRET)).status).toBe(400);
  });
  test('events: our own failure is a 500 so EventBridge retries', async () => {
    const { deps } = fakeDeps({ getEntitlements: async () => Promise.reject(new Error('throttled')) });
    const body = JSON.stringify(licenseEvent('License Updated - Manufacturer'));
    expect((await handleEvents(post(body, { [EVENTS_SECRET_HEADER]: SECRET }), deps, SECRET)).status).toBe(500);
  });
  test('onboarding redirects by outcome', async () => {
    const ob = onboarding().deps;
    expect((await handleOnboarding(post(form(VALID)), ob)).headers.get('location')).toBe('/aws/welcome?status=received');
    expect((await handleOnboarding(post(form({ ...VALID, country: '' })), ob)).headers.get('location')).toBe(
      '/aws/welcome?status=invalid',
    );
    expect((await handleOnboarding(post(form({ ...VALID, token: 'z'.repeat(43) })), ob)).headers.get('location')).toBe(
      '/aws/welcome?status=expired',
    );
  });
});
