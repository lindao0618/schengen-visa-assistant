-- CreateTable
CREATE TABLE "FrenchVisaTask" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL DEFAULT '',
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrenchVisaTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FrenchVisaTask_taskId_key" ON "FrenchVisaTask"("taskId");

-- CreateIndex
CREATE INDEX "FrenchVisaTask_userId_idx" ON "FrenchVisaTask"("userId");

-- CreateIndex
CREATE INDEX "FrenchVisaTask_userId_createdAt_idx" ON "FrenchVisaTask"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "FrenchVisaTask" ADD CONSTRAINT "FrenchVisaTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
