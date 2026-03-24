-- Align historical drift so fresh databases match the current Prisma schema.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "AdminSetting" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ContentBlock" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Applicant profiles and file metadata.
CREATE TABLE IF NOT EXISTS "ApplicantProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "usVisaAaCode" TEXT,
  "usVisaSurname" TEXT,
  "usVisaBirthYear" TEXT,
  "usVisaPassportNumber" TEXT,
  "schengenCountry" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicantProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApplicantFile" (
  "id" TEXT NOT NULL,
  "applicantProfileId" TEXT NOT NULL,
  "slot" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "storedName" TEXT NOT NULL,
  "relativePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicantFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ApplicantProfile_userId_idx" ON "ApplicantProfile"("userId");
CREATE INDEX IF NOT EXISTS "ApplicantProfile_userId_updatedAt_idx" ON "ApplicantProfile"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "ApplicantProfile_userId_name_idx" ON "ApplicantProfile"("userId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "ApplicantFile_applicantProfileId_slot_key" ON "ApplicantFile"("applicantProfileId", "slot");
CREATE INDEX IF NOT EXISTS "ApplicantFile_applicantProfileId_idx" ON "ApplicantFile"("applicantProfileId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ApplicantProfile_userId_fkey'
  ) THEN
    ALTER TABLE "ApplicantProfile"
    ADD CONSTRAINT "ApplicantProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ApplicantFile_applicantProfileId_fkey'
  ) THEN
    ALTER TABLE "ApplicantFile"
    ADD CONSTRAINT "ApplicantFile_applicantProfileId_fkey"
    FOREIGN KEY ("applicantProfileId") REFERENCES "ApplicantProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Explicit applicant ownership on task tables.
ALTER TABLE "UsVisaTask" ADD COLUMN IF NOT EXISTS "applicantProfileId" TEXT;
ALTER TABLE "FrenchVisaTask" ADD COLUMN IF NOT EXISTS "applicantProfileId" TEXT;

CREATE INDEX IF NOT EXISTS "UsVisaTask_applicantProfileId_idx" ON "UsVisaTask"("applicantProfileId");
CREATE INDEX IF NOT EXISTS "UsVisaTask_userId_applicantProfileId_createdAt_idx" ON "UsVisaTask"("userId", "applicantProfileId", "createdAt");
CREATE INDEX IF NOT EXISTS "FrenchVisaTask_applicantProfileId_idx" ON "FrenchVisaTask"("applicantProfileId");
CREATE INDEX IF NOT EXISTS "FrenchVisaTask_userId_applicantProfileId_createdAt_idx" ON "FrenchVisaTask"("userId", "applicantProfileId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UsVisaTask_applicantProfileId_fkey'
  ) THEN
    ALTER TABLE "UsVisaTask"
    ADD CONSTRAINT "UsVisaTask_applicantProfileId_fkey"
    FOREIGN KEY ("applicantProfileId") REFERENCES "ApplicantProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FrenchVisaTask_applicantProfileId_fkey'
  ) THEN
    ALTER TABLE "FrenchVisaTask"
    ADD CONSTRAINT "FrenchVisaTask_applicantProfileId_fkey"
    FOREIGN KEY ("applicantProfileId") REFERENCES "ApplicantProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
