-- CreateTable
CREATE TABLE "MediaReview" (
    "id" UUID NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaReview_itemId_createdAt_idx" ON "MediaReview"("itemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaReview_itemId_userId_key" ON "MediaReview"("itemId", "userId");
