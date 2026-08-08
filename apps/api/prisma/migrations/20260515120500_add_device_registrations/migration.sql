CREATE TABLE "DeviceRegistration" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'android',
  "token" TEXT NOT NULL,
  "appVersion" TEXT,
  "deviceId" TEXT,
  "deviceName" TEXT,
  "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DeviceRegistration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeviceRegistration_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeviceRegistration_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "UserAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DeviceRegistration_tenantId_token_key"
  ON "DeviceRegistration"("tenantId", "token");

CREATE INDEX "DeviceRegistration_tenantId_userId_platform_idx"
  ON "DeviceRegistration"("tenantId", "userId", "platform");
