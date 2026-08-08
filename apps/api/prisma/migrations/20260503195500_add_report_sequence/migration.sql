CREATE TABLE "ReportSequence" (
  "tenantId" TEXT PRIMARY KEY,
  "currentNumber" INTEGER NOT NULL DEFAULT 99999,
  CONSTRAINT "ReportSequence_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
