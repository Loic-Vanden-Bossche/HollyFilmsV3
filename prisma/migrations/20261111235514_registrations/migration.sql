-- CreateEnum
CREATE TYPE "RegistrationMethod" AS ENUM ('PASSWORD', 'GOOGLE');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'PROVISIONING', 'AWAITING_PASSWORD', 'ACTIVE', 'REJECTED');

-- CreateTable
CREATE TABLE "Registration" (
    "id" UUID NOT NULL,
    "method" "RegistrationMethod" NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "username" TEXT NOT NULL,
    "usernameKey" TEXT NOT NULL,
    "technicalName" TEXT NOT NULL,
    "googleIssuer" TEXT,
    "googleSubject" TEXT,
    "googleEmail" TEXT,
    "passwordHash" TEXT,
    "technicalPassword" TEXT,
    "jellyfinId" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleFlow" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "callbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "registrationId" UUID,

    CONSTRAINT "GoogleFlow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Registration_usernameKey_key" ON "Registration"("usernameKey");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_technicalName_key" ON "Registration"("technicalName");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_jellyfinId_key" ON "Registration"("jellyfinId");

-- CreateIndex
CREATE INDEX "Registration_status_createdAt_idx" ON "Registration"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_googleIssuer_googleSubject_key" ON "Registration"("googleIssuer", "googleSubject");

-- CreateIndex
CREATE INDEX "GoogleFlow_expiresAt_idx" ON "GoogleFlow"("expiresAt");

-- AddForeignKey
ALTER TABLE "GoogleFlow" ADD CONSTRAINT "GoogleFlow_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
