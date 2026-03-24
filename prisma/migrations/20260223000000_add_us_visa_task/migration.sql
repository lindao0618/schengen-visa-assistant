-- CreateTable
CREATE TABLE "UsVisaTask" (
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

    CONSTRAINT "UsVisaTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsVisaTask_taskId_key" ON "UsVisaTask"("taskId");

-- CreateIndex
CREATE INDEX "UsVisaTask_userId_idx" ON "UsVisaTask"("userId");

-- CreateIndex
CREATE INDEX "UsVisaTask_userId_createdAt_idx" ON "UsVisaTask"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UsVisaTask" ADD CONSTRAINT "UsVisaTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
