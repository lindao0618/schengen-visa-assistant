ALTER TABLE "ApplicantProfile"
ADD COLUMN IF NOT EXISTS "usVisaIntakeJson" JSONB,
ADD COLUMN IF NOT EXISTS "schengenIntakeJson" JSONB;
