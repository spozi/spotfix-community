-- v2 geo: campus boundary config + landmarks.
-- Powers the outside-campus warning, automatic landmark/address association,
-- and the public monitoring dashboard. Additive only — v1 untouched.

CREATE TABLE "TenantGeoV2" (
  "tenantId"    TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "centerLat"   DOUBLE PRECISION NOT NULL,
  "centerLng"   DOUBLE PRECISION NOT NULL,
  "defaultZoom" INTEGER NOT NULL DEFAULT 15,
  "boundary"    JSONB NOT NULL DEFAULT '[]',
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TenantGeoV2_pkey" PRIMARY KEY ("tenantId"),
  CONSTRAINT "TenantGeoV2_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CampusLandmarkV2" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "category"  TEXT NOT NULL DEFAULT 'building',
  "lat"       DOUBLE PRECISION NOT NULL,
  "lng"       DOUBLE PRECISION NOT NULL,
  "radiusM"   INTEGER NOT NULL DEFAULT 200,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CampusLandmarkV2_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CampusLandmarkV2_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CampusLandmarkV2_tenantId_name_key"
  ON "CampusLandmarkV2"("tenantId", "name");
CREATE INDEX "CampusLandmarkV2_tenantId_idx"
  ON "CampusLandmarkV2"("tenantId");
