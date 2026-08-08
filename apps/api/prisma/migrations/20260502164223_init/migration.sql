-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT,
    "googleSub" TEXT,
    "email" TEXT,
    "role" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterUser" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MasterUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cleaner" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "phone" TEXT,
    "supervisorId" TEXT,
    "supervisorName" TEXT,
    "assignedTaskId" TEXT,
    "busyUntil" TIMESTAMP(3),

    CONSTRAINT "Cleaner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "category" TEXT,
    "location" TEXT,
    "details" TEXT,
    "coordinates" JSONB,
    "reporterPhone" TEXT,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "assignedTo" TEXT,
    "assignedToCleanerId" TEXT,
    "assignedBySupervisorId" TEXT,
    "assignedBySupervisorName" TEXT,
    "evidencePhoto" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "resolutionPhoto" TEXT,
    "photoTimestamp" TEXT,
    "resolutionTimestamp" TEXT,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "UserAccount_tenantId_role_idx" ON "UserAccount"("tenantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_tenantId_idNumber_key" ON "UserAccount"("tenantId", "idNumber");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_tenantId_googleSub_key" ON "UserAccount"("tenantId", "googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_tenantId_email_key" ON "UserAccount"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "MasterUser_tenantId_username_key" ON "MasterUser"("tenantId", "username");

-- CreateIndex
CREATE INDEX "Cleaner_tenantId_supervisorId_idx" ON "Cleaner"("tenantId", "supervisorId");

-- CreateIndex
CREATE INDEX "Cleaner_tenantId_assignedTaskId_idx" ON "Cleaner"("tenantId", "assignedTaskId");

-- CreateIndex
CREATE INDEX "Report_tenantId_userId_timestamp_idx" ON "Report"("tenantId", "userId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "Report_tenantId_status_timestamp_idx" ON "Report"("tenantId", "status", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Report_tenantId_publicId_key" ON "Report"("tenantId", "publicId");

-- AddForeignKey
ALTER TABLE "UserAccount" ADD CONSTRAINT "UserAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterUser" ADD CONSTRAINT "MasterUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cleaner" ADD CONSTRAINT "Cleaner_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
