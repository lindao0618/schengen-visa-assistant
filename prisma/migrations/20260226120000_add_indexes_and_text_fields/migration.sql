-- AlterTable: ensure long-text columns use TEXT type (no-op if already TEXT)
ALTER TABLE "Document" ALTER COLUMN "aiAnalysis" SET DATA TYPE TEXT;
ALTER TABLE "Review" ALTER COLUMN "result" SET DATA TYPE TEXT;
ALTER TABLE "Review" ALTER COLUMN "feedback" SET DATA TYPE TEXT;

-- CreateIndex: Application
CREATE INDEX "Application_userId_idx" ON "Application"("userId");
CREATE INDEX "Application_userId_status_idx" ON "Application"("userId", "status");
CREATE INDEX "Application_userId_createdAt_idx" ON "Application"("userId", "createdAt");

-- CreateIndex: Document
CREATE INDEX "Document_userId_idx" ON "Document"("userId");
CREATE INDEX "Document_applicationId_idx" ON "Document"("applicationId");
CREATE INDEX "Document_userId_status_idx" ON "Document"("userId", "status");
CREATE INDEX "Document_applicationId_status_idx" ON "Document"("applicationId", "status");

-- CreateIndex: Review
CREATE INDEX "Review_applicationId_idx" ON "Review"("applicationId");
CREATE INDEX "Review_documentId_idx" ON "Review"("documentId");
CREATE INDEX "Review_applicationId_documentId_idx" ON "Review"("applicationId", "documentId");

-- CreateIndex: Account, Session (NextAuth lookups by userId)
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex: task list by status
CREATE INDEX "UsVisaTask_userId_status_idx" ON "UsVisaTask"("userId", "status");
CREATE INDEX "FrenchVisaTask_userId_status_idx" ON "FrenchVisaTask"("userId", "status");
