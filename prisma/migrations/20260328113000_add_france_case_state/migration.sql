CREATE TABLE "VisaCase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicantProfileId" TEXT NOT NULL,
    "caseType" TEXT NOT NULL DEFAULT 'france-schengen',
    "mainStatus" TEXT NOT NULL,
    "subStatus" TEXT,
    "exceptionCode" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "assignedRole" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "paymentConfirmedAt" TIMESTAMP(3),
    "formSubmittedAt" TIMESTAMP(3),
    "docsReadyAt" TIMESTAMP(3),
    "slotBookedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "nextActionAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisaCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VisaCaseStatusHistory" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fromMainStatus" TEXT,
    "fromSubStatus" TEXT,
    "toMainStatus" TEXT NOT NULL,
    "toSubStatus" TEXT,
    "exceptionCode" TEXT,
    "reason" TEXT,
    "operatorType" TEXT NOT NULL DEFAULT 'system',
    "operatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisaCaseStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReminderRule" (
    "id" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "caseType" TEXT NOT NULL DEFAULT 'france-schengen',
    "mainStatus" TEXT,
    "subStatus" TEXT,
    "exceptionCode" TEXT,
    "triggerType" TEXT NOT NULL,
    "triggerValue" JSONB,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "channels" TEXT[],
    "automationMode" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 0,
    "stopCondition" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "ruleId" TEXT,
    "userId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "automationMode" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "renderedContent" TEXT,
    "sendStatus" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReminderRule_ruleCode_key" ON "ReminderRule"("ruleCode");
CREATE INDEX "VisaCase_userId_caseType_isActive_idx" ON "VisaCase"("userId", "caseType", "isActive");
CREATE INDEX "VisaCase_applicantProfileId_caseType_isActive_idx" ON "VisaCase"("applicantProfileId", "caseType", "isActive");
CREATE INDEX "VisaCase_userId_mainStatus_updatedAt_idx" ON "VisaCase"("userId", "mainStatus", "updatedAt");
CREATE INDEX "VisaCase_userId_applicantProfileId_updatedAt_idx" ON "VisaCase"("userId", "applicantProfileId", "updatedAt");
CREATE INDEX "VisaCaseStatusHistory_caseId_createdAt_idx" ON "VisaCaseStatusHistory"("caseId", "createdAt");
CREATE INDEX "VisaCaseStatusHistory_toMainStatus_createdAt_idx" ON "VisaCaseStatusHistory"("toMainStatus", "createdAt");
CREATE INDEX "ReminderRule_caseType_enabled_idx" ON "ReminderRule"("caseType", "enabled");
CREATE INDEX "ReminderRule_caseType_mainStatus_subStatus_idx" ON "ReminderRule"("caseType", "mainStatus", "subStatus");
CREATE INDEX "ReminderRule_caseType_exceptionCode_idx" ON "ReminderRule"("caseType", "exceptionCode");
CREATE INDEX "ReminderLog_caseId_triggeredAt_idx" ON "ReminderLog"("caseId", "triggeredAt");
CREATE INDEX "ReminderLog_userId_triggeredAt_idx" ON "ReminderLog"("userId", "triggeredAt");
CREATE INDEX "ReminderLog_ruleCode_triggeredAt_idx" ON "ReminderLog"("ruleCode", "triggeredAt");

ALTER TABLE "VisaCase"
ADD CONSTRAINT "VisaCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VisaCase"
ADD CONSTRAINT "VisaCase_applicantProfileId_fkey" FOREIGN KEY ("applicantProfileId") REFERENCES "ApplicantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VisaCaseStatusHistory"
ADD CONSTRAINT "VisaCaseStatusHistory_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "VisaCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReminderLog"
ADD CONSTRAINT "ReminderLog_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "VisaCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReminderLog"
ADD CONSTRAINT "ReminderLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ReminderRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReminderLog"
ADD CONSTRAINT "ReminderLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
