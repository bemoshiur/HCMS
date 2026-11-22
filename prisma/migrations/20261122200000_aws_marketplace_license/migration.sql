-- CreateTable
CREATE TABLE "MarketplaceLicense" (
    "id" TEXT NOT NULL,
    "licenseArn" TEXT NOT NULL,
    "agreementId" TEXT,
    "customerIdentifier" TEXT,
    "customerAwsAccountId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'registered',
    "entitlementDimension" TEXT,
    "entitlementExpiresAt" TIMESTAMP(3),
    "entitlementRaw" JSONB,
    "entitlementCheckedAt" TIMESTAMP(3),
    "onboardingTokenHash" TEXT,
    "onboardingTokenExpiresAt" TIMESTAMP(3),
    "organisationName" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "country" TEXT,
    "onboardingSubmittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceLicense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceLicense_onboardingTokenHash_key" ON "MarketplaceLicense"("onboardingTokenHash");

-- CreateIndex
CREATE INDEX "MarketplaceLicense_customerAwsAccountId_idx" ON "MarketplaceLicense"("customerAwsAccountId");

-- CreateIndex
CREATE INDEX "MarketplaceLicense_agreementId_idx" ON "MarketplaceLicense"("agreementId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceLicense_productCode_licenseArn_key" ON "MarketplaceLicense"("productCode", "licenseArn");

