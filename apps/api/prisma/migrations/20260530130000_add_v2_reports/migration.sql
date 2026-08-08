-- v2 reports / events / notifications (Stage 2)

CREATE TABLE "ReportV2" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "assignedSupervisorId" TEXT,
    "assignedCleanerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "locationAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportV2_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportV2_tenantId_reporterUserId_createdAt_idx"
    ON "ReportV2"("tenantId", "reporterUserId", "createdAt" DESC);
CREATE INDEX "ReportV2_tenantId_assignedCleanerId_status_idx"
    ON "ReportV2"("tenantId", "assignedCleanerId", "status");
CREATE INDEX "ReportV2_tenantId_assignedSupervisorId_status_idx"
    ON "ReportV2"("tenantId", "assignedSupervisorId", "status");
CREATE INDEX "ReportV2_tenantId_status_createdAt_idx"
    ON "ReportV2"("tenantId", "status", "createdAt" DESC);

ALTER TABLE "ReportV2"
    ADD CONSTRAINT "ReportV2_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportV2"
    ADD CONSTRAINT "ReportV2_reporterUserId_fkey"
    FOREIGN KEY ("reporterUserId") REFERENCES "UserAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportV2"
    ADD CONSTRAINT "ReportV2_assignedSupervisorId_fkey"
    FOREIGN KEY ("assignedSupervisorId") REFERENCES "UserAccount"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReportV2"
    ADD CONSTRAINT "ReportV2_assignedCleanerId_fkey"
    FOREIGN KEY ("assignedCleanerId") REFERENCES "UserAccount"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReportAttachmentV2" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "attachmentType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileMimeType" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportAttachmentV2_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportAttachmentV2_tenantId_reportId_idx"
    ON "ReportAttachmentV2"("tenantId", "reportId");

ALTER TABLE "ReportAttachmentV2"
    ADD CONSTRAINT "ReportAttachmentV2_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportAttachmentV2"
    ADD CONSTRAINT "ReportAttachmentV2_reportId_fkey"
    FOREIGN KEY ("reportId") REFERENCES "ReportV2"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportAttachmentV2"
    ADD CONSTRAINT "ReportAttachmentV2_uploadedByUserId_fkey"
    FOREIGN KEY ("uploadedByUserId") REFERENCES "UserAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReportEventV2" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportEventV2_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportEventV2_seq_key" ON "ReportEventV2"("seq");
CREATE INDEX "ReportEventV2_tenantId_seq_idx" ON "ReportEventV2"("tenantId", "seq");
CREATE INDEX "ReportEventV2_tenantId_reportId_createdAt_idx"
    ON "ReportEventV2"("tenantId", "reportId", "createdAt" DESC);

ALTER TABLE "ReportEventV2"
    ADD CONSTRAINT "ReportEventV2_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportEventV2"
    ADD CONSTRAINT "ReportEventV2_reportId_fkey"
    FOREIGN KEY ("reportId") REFERENCES "ReportV2"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportEventV2"
    ADD CONSTRAINT "ReportEventV2_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "UserAccount"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "NotificationV2" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT,
    "reportId" TEXT,
    "eventId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "NotificationV2_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationV2_tenantId_userId_createdAt_idx"
    ON "NotificationV2"("tenantId", "userId", "createdAt" DESC);
CREATE INDEX "NotificationV2_tenantId_userId_isRead_idx"
    ON "NotificationV2"("tenantId", "userId", "isRead");

ALTER TABLE "NotificationV2"
    ADD CONSTRAINT "NotificationV2_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationV2"
    ADD CONSTRAINT "NotificationV2_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "UserAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationV2"
    ADD CONSTRAINT "NotificationV2_reportId_fkey"
    FOREIGN KEY ("reportId") REFERENCES "ReportV2"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationV2"
    ADD CONSTRAINT "NotificationV2_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "ReportEventV2"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
