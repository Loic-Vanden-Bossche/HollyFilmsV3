-- CreateTable
CREATE TABLE "SubtitleTiming" (
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "manualMs" INTEGER NOT NULL,
    "scale" DOUBLE PRECISION,
    "shiftMs" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubtitleTiming_pkey" PRIMARY KEY ("userId","fingerprint")
);

-- CreateTable
CREATE TABLE "SubtitleAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "processedSeconds" INTEGER NOT NULL DEFAULT 0,
    "scale" DOUBLE PRECISION,
    "shiftMs" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubtitleAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubtitleAnalysis_stage_updatedAt_idx" ON "SubtitleAnalysis"("stage", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubtitleAnalysis_userId_fingerprint_engine_key" ON "SubtitleAnalysis"("userId", "fingerprint", "engine");
