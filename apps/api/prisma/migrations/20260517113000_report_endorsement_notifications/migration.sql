ALTER TABLE "DeviceRegistration"
  ALTER COLUMN "userId" DROP NOT NULL,
  ADD COLUMN "masterUserId" TEXT;

ALTER TABLE "DeviceRegistration"
  ADD CONSTRAINT "DeviceRegistration_masterUserId_fkey"
  FOREIGN KEY ("masterUserId") REFERENCES "MasterUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "DeviceRegistration_tenantId_masterUserId_platform_idx"
  ON "DeviceRegistration"("tenantId", "masterUserId", "platform");

ALTER TABLE "Report"
  ADD COLUMN "resolutionCoordinates" JSONB,
  ADD COLUMN "resolutionDistanceMeters" DOUBLE PRECISION,
  ADD COLUMN "reviewedAt" TEXT,
  ADD COLUMN "reviewedBySupervisorId" TEXT,
  ADD COLUMN "reviewedBySupervisorName" TEXT,
  ADD COLUMN "reviewNotes" TEXT;

CREATE TABLE "NotificationEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT,
  "masterUserId" TEXT,
  "reportPublicId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "isCritical" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationEvent_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NotificationEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "UserAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NotificationEvent_masterUserId_fkey"
    FOREIGN KEY ("masterUserId") REFERENCES "MasterUser"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "NotificationEvent_tenantId_userId_createdAt_idx"
  ON "NotificationEvent"("tenantId", "userId", "createdAt" DESC);

CREATE INDEX "NotificationEvent_tenantId_masterUserId_createdAt_idx"
  ON "NotificationEvent"("tenantId", "masterUserId", "createdAt" DESC);

CREATE INDEX "NotificationEvent_tenantId_reportPublicId_createdAt_idx"
  ON "NotificationEvent"("tenantId", "reportPublicId", "createdAt" DESC);