-- CreateEnum
CREATE TYPE "Role" AS ENUM ('APPLICANT', 'AUTHORITY_OFFICER', 'INTAKE_OFFICER', 'AGA_REVIEWER', 'CNS_REVIEWER', 'PANSOPS_REVIEWER', 'APPROVER', 'STUDY_OFFICER', 'ADMIN', 'AUDITOR');

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('APPLICANT', 'AUTHORITY', 'CAAB');

-- CreateEnum
CREATE TYPE "ApproachType" AS ENUM ('NON_INSTRUMENT', 'NON_PRECISION', 'PRECISION_I', 'PRECISION_II', 'PRECISION_III');

-- CreateEnum
CREATE TYPE "NavaidType" AS ENUM ('VOR', 'DME', 'ILS_GP', 'ILS_LOC', 'NDB');

-- CreateEnum
CREATE TYPE "OlsFramework" AS ENUM ('ANNEX14_CLASSIC', 'OFS_OES');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ENDORSED', 'INTAKE_SCRUTINY', 'UNDER_REVIEW', 'STUDY', 'DECISION_PENDING', 'APPROVED', 'REJECTED', 'RETURNED_FOR_INFO', 'CERTIFICATE_ISSUED', 'REVALIDATION', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "EvalStatus" AS ENUM ('CLEAR', 'OBJECTION', 'OUTSIDE');

-- CreateEnum
CREATE TYPE "Discipline" AS ENUM ('AGA', 'CNS', 'PANSOPS');

-- CreateEnum
CREATE TYPE "ReviewVerdict" AS ENUM ('CONFIRM', 'OVERRIDE', 'REFER_STUDY');

-- CreateEnum
CREATE TYPE "StudyType" AS ENUM ('AERONAUTICAL', 'SHIELDING');

-- CreateEnum
CREATE TYPE "StudyOutcome" AS ENUM ('PERMIT_WITH_CONDITIONS', 'REFUSE');

-- CreateEnum
CREATE TYPE "CertDecision" AS ENUM ('GRANTED', 'OBJECTION');

-- CreateEnum
CREATE TYPE "CertStatus" AS ENUM ('ISSUED', 'REVOKED', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ObstacleSource" AS ENUM ('CERTIFIED', 'SURVEY', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "ObstacleStatus" AS ENUM ('COMPLIANT', 'PENETRATING', 'UNDER_MONITORING', 'ILLEGAL');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('OWNERSHIP', 'SITE_PLAN', 'ELEVATION_CERT', 'MOUZA_MAP', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'IN_APP');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PAID', 'WAIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "orgId" TEXT,
    "jurisdiction" TEXT,
    "phone" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "type" "OrgType" NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "tradeLicense" TEXT,
    "authorityCode" TEXT,
    "city" TEXT,
    "contact" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Airport" (
    "id" TEXT NOT NULL,
    "icao" TEXT NOT NULL,
    "iata" TEXT,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "city" TEXT NOT NULL,
    "elevationM" DOUBLE PRECISION NOT NULL,
    "referenceLat" DOUBLE PRECISION NOT NULL,
    "referenceLon" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Airport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Runway" (
    "id" TEXT NOT NULL,
    "airportId" TEXT NOT NULL,
    "designator" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "approachType" "ApproachType" NOT NULL,
    "lengthM" DOUBLE PRECISION NOT NULL,
    "trueBearingDeg" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Runway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Threshold" (
    "id" TEXT NOT NULL,
    "runwayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "elevationM" DOUBLE PRECISION NOT NULL,
    "approximate" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Threshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Navaid" (
    "id" TEXT NOT NULL,
    "airportId" TEXT NOT NULL,
    "type" "NavaidType" NOT NULL,
    "name" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "protectionRadiusM" DOUBLE PRECISION NOT NULL,
    "note" TEXT,

    CONSTRAINT "Navaid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OlsParameterSet" (
    "id" TEXT NOT NULL,
    "airportId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "framework" "OlsFramework" NOT NULL DEFAULT 'ANNEX14_CLASSIC',
    "json" JSONB NOT NULL,
    "signedOffBy" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OlsParameterSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "applicantOrgId" TEXT NOT NULL,
    "authorityOrgId" TEXT,
    "airportId" TEXT NOT NULL,
    "structureType" TEXT NOT NULL,
    "siteAddress" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "groundElevationM" DOUBLE PRECISION NOT NULL,
    "requestedHeightAglM" DOUBLE PRECISION NOT NULL,
    "requestedTopElevationAmslM" DOUBLE PRECISION NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "slaDueAt" TIMESTAMP(3),
    "assignedDisciplines" "Discipline"[],
    "assignedOfficerId" TEXT,
    "createdById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationResult" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "governingSurface" TEXT,
    "ptE_amslM" DOUBLE PRECISION,
    "permissibleAglM" DOUBLE PRECISION,
    "penetrationM" DOUBLE PRECISION,
    "status" "EvalStatus" NOT NULL,
    "surfaces" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "engineVersion" TEXT NOT NULL,

    CONSTRAINT "EvaluationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplineReview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "discipline" "Discipline" NOT NULL,
    "reviewerId" TEXT,
    "verdict" "ReviewVerdict",
    "overrideValueAmslM" DOUBLE PRECISION,
    "remarks" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisciplineReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Study" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "StudyType" NOT NULL,
    "findings" TEXT,
    "proposedConditions" TEXT[],
    "outcome" "StudyOutcome",
    "officerId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Study_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "hcNo" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "decision" "CertDecision" NOT NULL,
    "ptE_amslM" DOUBLE PRECISION NOT NULL,
    "permissibleAglM" DOUBLE PRECISION NOT NULL,
    "governingSurface" TEXT,
    "conditions" TEXT[],
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "qrToken" TEXT NOT NULL,
    "status" "CertStatus" NOT NULL DEFAULT 'ISSUED',
    "signedById" TEXT,
    "supersededById" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obstacle" (
    "id" TEXT NOT NULL,
    "airportId" TEXT NOT NULL,
    "name" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "topElevationAmslM" DOUBLE PRECISION NOT NULL,
    "heightAglM" DOUBLE PRECISION,
    "source" "ObstacleSource" NOT NULL,
    "structureType" TEXT NOT NULL,
    "status" "ObstacleStatus" NOT NULL DEFAULT 'COMPLIANT',
    "linkedApplicationId" TEXT,
    "remarks" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Obstacle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentFile" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "data" BYTEA,
    "sizeBytes" INTEGER,
    "mimeType" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeInvoice" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "method" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "event" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructureTypeDef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StructureTypeDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeScheduleItem" (
    "id" TEXT NOT NULL,
    "structureType" TEXT NOT NULL,
    "heightBandM" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FeeScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Airport_icao_key" ON "Airport"("icao");

-- CreateIndex
CREATE UNIQUE INDEX "OlsParameterSet_airportId_version_key" ON "OlsParameterSet"("airportId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Application_refNo_key" ON "Application"("refNo");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "Application_airportId_idx" ON "Application"("airportId");

-- CreateIndex
CREATE INDEX "Application_applicantOrgId_idx" ON "Application"("applicantOrgId");

-- CreateIndex
CREATE INDEX "Application_authorityOrgId_idx" ON "Application"("authorityOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "DisciplineReview_applicationId_discipline_key" ON "DisciplineReview"("applicationId", "discipline");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_hcNo_key" ON "Certificate"("hcNo");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_qrToken_key" ON "Certificate"("qrToken");

-- CreateIndex
CREATE INDEX "Certificate_status_idx" ON "Certificate"("status");

-- CreateIndex
CREATE INDEX "Obstacle_airportId_idx" ON "Obstacle"("airportId");

-- CreateIndex
CREATE INDEX "Obstacle_status_idx" ON "Obstacle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FeeInvoice_invoiceNo_key" ON "FeeInvoice"("invoiceNo");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "CaseEvent_applicationId_at_idx" ON "CaseEvent"("applicationId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "StructureTypeDef_name_key" ON "StructureTypeDef"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Runway" ADD CONSTRAINT "Runway_airportId_fkey" FOREIGN KEY ("airportId") REFERENCES "Airport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Threshold" ADD CONSTRAINT "Threshold_runwayId_fkey" FOREIGN KEY ("runwayId") REFERENCES "Runway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Navaid" ADD CONSTRAINT "Navaid_airportId_fkey" FOREIGN KEY ("airportId") REFERENCES "Airport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OlsParameterSet" ADD CONSTRAINT "OlsParameterSet_airportId_fkey" FOREIGN KEY ("airportId") REFERENCES "Airport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_applicantOrgId_fkey" FOREIGN KEY ("applicantOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_authorityOrgId_fkey" FOREIGN KEY ("authorityOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_airportId_fkey" FOREIGN KEY ("airportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_assignedOfficerId_fkey" FOREIGN KEY ("assignedOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationResult" ADD CONSTRAINT "EvaluationResult_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineReview" ADD CONSTRAINT "DisciplineReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineReview" ADD CONSTRAINT "DisciplineReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Study" ADD CONSTRAINT "Study_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Study" ADD CONSTRAINT "Study_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obstacle" ADD CONSTRAINT "Obstacle_airportId_fkey" FOREIGN KEY ("airportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obstacle" ADD CONSTRAINT "Obstacle_linkedApplicationId_fkey" FOREIGN KEY ("linkedApplicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFile" ADD CONSTRAINT "DocumentFile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFile" ADD CONSTRAINT "DocumentFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvent" ADD CONSTRAINT "CaseEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvent" ADD CONSTRAINT "CaseEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
