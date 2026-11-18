-- CreateEnum
CREATE TYPE "SubtitleRequestStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'DOWNLOADED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "SubtitleRequest" (
    "id" UUID NOT NULL,
    "itemId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "activeKey" TEXT,
    "status" "SubtitleRequestStatus" NOT NULL DEFAULT 'PENDING',
    "remoteId" TEXT,
    "baseline" TEXT,
    "startedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubtitleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubtitleRequest_activeKey_key" ON "SubtitleRequest"("activeKey");

-- CreateIndex
CREATE INDEX "SubtitleRequest_requesterId_createdAt_idx" ON "SubtitleRequest"("requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "SubtitleRequest_status_createdAt_idx" ON "SubtitleRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SubtitleRequest_sourceId_status_idx" ON "SubtitleRequest"("sourceId", "status");
