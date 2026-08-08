-- API v2 / Android v2: DeviceV2, DeviceSession, UserRoleV2

CREATE TABLE "DeviceV2" (
  "id"                    TEXT NOT NULL,
  "tenantId"              TEXT NOT NULL,
  "userId"                TEXT,
  "platform"              TEXT NOT NULL DEFAULT 'android',
  "deviceName"            TEXT,
  "deviceFingerprintHash" TEXT NOT NULL,
  "fcmToken"              TEXT,
  "appVersion"            TEXT,
  "osVersion"             TEXT,
  "isActive"              BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DeviceV2_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeviceV2_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeviceV2_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "UserAccount"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DeviceV2_tenantId_deviceFingerprintHash_key"
  ON "DeviceV2"("tenantId", "deviceFingerprintHash");
CREATE INDEX "DeviceV2_tenantId_userId_idx"
  ON "DeviceV2"("tenantId", "userId");

CREATE TABLE "DeviceSession" (
  "id"               TEXT NOT NULL,
  "tenantId"         TEXT NOT NULL,
  "deviceId"         TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "revokedAt"        TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeviceSession_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeviceSession_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "DeviceV2"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeviceSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "UserAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DeviceSession_tenantId_deviceId_isActive_idx"
  ON "DeviceSession"("tenantId", "deviceId", "isActive");
CREATE INDEX "DeviceSession_tenantId_userId_isActive_idx"
  ON "DeviceSession"("tenantId", "userId", "isActive");

CREATE TABLE "UserRoleV2" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "role"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserRoleV2_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserRoleV2_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserRoleV2_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "UserAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserRoleV2_tenantId_userId_role_key"
  ON "UserRoleV2"("tenantId", "userId", "role");
CREATE INDEX "UserRoleV2_tenantId_role_idx"
  ON "UserRoleV2"("tenantId", "role");
