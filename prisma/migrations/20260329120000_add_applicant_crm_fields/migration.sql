-- Applicant CRM fields
ALTER TABLE "ApplicantProfile"
ADD COLUMN "phone" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "wechat" TEXT,
ADD COLUMN "passportNumber" TEXT,
ADD COLUMN "passportLast4" TEXT,
ADD COLUMN "note" TEXT;

CREATE INDEX "ApplicantProfile_phone_idx" ON "ApplicantProfile"("phone");
CREATE INDEX "ApplicantProfile_email_idx" ON "ApplicantProfile"("email");
CREATE INDEX "ApplicantProfile_passportNumber_idx" ON "ApplicantProfile"("passportNumber");

-- Visa case CRM fields
ALTER TABLE "VisaCase"
ADD COLUMN "visaType" TEXT,
ADD COLUMN "applyRegion" TEXT,
ADD COLUMN "tlsCity" TEXT,
ADD COLUMN "travelDate" TIMESTAMP(3),
ADD COLUMN "submissionDate" TIMESTAMP(3),
ADD COLUMN "assignedToUserId" TEXT;

ALTER TABLE "VisaCase"
ADD CONSTRAINT "VisaCase_assignedToUserId_fkey"
FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "VisaCase_assignedToUserId_idx" ON "VisaCase"("assignedToUserId");
CREATE INDEX "VisaCase_visaType_applyRegion_idx" ON "VisaCase"("visaType", "applyRegion");
