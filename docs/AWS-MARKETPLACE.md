# HCMS on AWS Marketplace (SaaS contract)

Why this exists: TiCON's AWS Partner Solutions Finder page shows a solution only after
it passes the Foundational Technical Review (FTR). FTR needs one linked **SaaS**
Marketplace product deployed on AWS, and a SaaS listing needs a working fulfillment URL
and subscription-event handling. This document is that integration.

Partner Central product: `prod-zrfftunbrvpji` (HCMS). Seller account 542374379351.

## Integration model (AWS rules for SaaS products created after 1 June 2026)

- **LicenseArn, not CustomerIdentifier.** Concurrent Agreements let one AWS account
  hold several licenses for the same product, so each purchase is a row keyed by
  `(productCode, licenseArn)` in `MarketplaceLicense`.
- **EventBridge, not SNS.** Sellers registered after 15 July 2026 get no SNS topics;
  subscription changes are EventBridge events from source `aws.agreement-marketplace`.

## What happens when someone buys

1. AWS posts the buyer's browser to `https://hcms.ticonsys.com/api/aws/register` with
   `x-amzn-marketplace-token`.
2. `ResolveCustomer` (us-east-1) returns `LicenseArn`, `CustomerAWSAccountId`,
   `ProductCode`; the product code is checked; `GetEntitlements` filtered by
   `LICENSE_ARN` reads the dimension.
3. The browser is redirected to `/aws/welcome#t=<one-time token>`. The token lives in
   the URL fragment (never sent to a server); the database keeps only its SHA-256,
   valid 7 days, single use.
4. The buyer submits organisation, contact and country. Every active ADMIN gets an
   in-app notification and a structured `aws_mp_onboarded` line goes to the Amplify
   compute logs (HCMS has no outbound email in this build).
5. TiCON provisions the authority's environment by hand. HCMS is deployed per
   aviation authority, so a purchase deliberately does not create a tenant.

## Events (`POST /api/aws/events`)

| EventBridge `detail-type` | What we do |
|---|---|
| `License Updated - Manufacturer` | Upsert the license (records `agreement.id`), re-read entitlements, status `active` if one is live, else `deprovisioned` |
| `License Deprovisioned - Manufacturer` | Re-read entitlements, status `deprovisioned` |
| `Purchase Agreement Ended - Proposer` / `- Manufacturer` | Status `agreement-ended` on rows with that agreement id |
| anything else, or another TiCON product | `200`, ignored |

The `x-ticon-mp-secret` header must equal `AWS_MP_EVENTS_SECRET` or the answer is `401`.
Malformed events get `400`; our own failures `500`, so the API destination retries.

## Contract dimensions (offer must use these API names)

| Dimension | Intended for |
|---|---|
| `standard` | One aerodrome authority |
| `professional` | Adds study workflows and public verification at scale |
| `enterprise` | National, multi-aerodrome deployments |

## Setup checklist (production)

1. Amplify → App settings → Environment variables:
   - `AWS_MP_PRODUCT_CODE` = product code (Product summary → Show more).
   - `AWS_MP_EVENTS_SECRET` = random, 32+ characters (`openssl rand -base64 36`).
   - `AWS_MP_OPS_EMAIL` (optional, appears in the log line).
   `amplify.yml` copies `AWS_MP_*` into `.env.production` for the SSR runtime. Until
   the product code is set, every `/api/aws/*` route answers 404.
2. Amplify → App settings → IAM roles → **SSR compute role** with:
   ```json
   { "Version": "2012-10-17", "Statement": [{ "Effect": "Allow",
     "Action": ["aws-marketplace:ResolveCustomer", "aws-marketplace:GetEntitlements"],
     "Resource": "*" }] }
   ```
   The Amplify app must live in the seller account 542374379351, or the role must be
   able to call Marketplace as that account.
3. Migration `20261122200000_aws_marketplace_license` runs in the Amplify preBuild
   (`prisma migrate deploy`); run it manually if the deploy logged a lock timeout.
4. EventBridge in the **seller account, us-east-1, default bus**: reuse connection
   `ticon-mp-events` (API key `x-ticon-mp-secret`), add API destination
   `hcms-mp-events` → `POST https://hcms.ticonsys.com/api/aws/events`, and add it as
   a target on rule `ticon-mp-agreements` (pattern
   `{"source": ["aws.agreement-marketplace"]}`), retry 24 h, SQS dead-letter queue.
5. AWS Revenue Measurement for FTR: tag the Amplify app (and every other AWS resource
   HCMS uses) `aws-apn-id = pc:<product code>`.

## Tests

- `pnpm test` runs the decision logic and HTTP handler tests.
- With `TEST_DATABASE_URL` pointing at a database that has the migration applied,
  `lib/marketplace/store.db.test.ts` also runs the Prisma writes (idempotent upsert,
  token rotation, single-use onboarding, expiry, concurrent licenses, agreement end).
