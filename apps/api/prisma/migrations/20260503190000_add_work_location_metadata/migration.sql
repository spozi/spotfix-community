-- Persist deterministic location metadata for supervisor/cleaner assignment.
ALTER TABLE "UserAccount"
ADD COLUMN "workLocation" TEXT;

ALTER TABLE "Cleaner"
ADD COLUMN "workLocation" TEXT;
