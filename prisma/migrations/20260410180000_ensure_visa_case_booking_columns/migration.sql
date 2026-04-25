-- Idempotent: local DBs that already had some of these columns can still apply remaining migrations.
ALTER TABLE "VisaCase" ADD COLUMN IF NOT EXISTS "bookingWindow" TEXT;
ALTER TABLE "VisaCase" ADD COLUMN IF NOT EXISTS "acceptVip" TEXT;
ALTER TABLE "VisaCase" ADD COLUMN IF NOT EXISTS "slotTime" TIMESTAMP(3);
