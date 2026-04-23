-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN "memberGithubId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "metadata" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "source" TEXT;

-- CreateIndex
CREATE INDEX "ActivityLog_type_idx" ON "ActivityLog"("type");

-- CreateIndex
CREATE INDEX "ActivityLog_memberGithubId_idx" ON "ActivityLog"("memberGithubId");

-- CreateIndex
CREATE INDEX "ActivityLog_source_idx" ON "ActivityLog"("source");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
