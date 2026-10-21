-- CreateTable
CREATE TABLE "SyncJobRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "lane" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cohort" INTEGER,
    "repoId" INTEGER,
    "githubId" TEXT,
    "blogSource" TEXT,
    "label" TEXT,
    "quiet" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "result" TEXT,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "SyncJobRecord_status_idx" ON "SyncJobRecord"("status");

-- CreateIndex
CREATE INDEX "SyncJobRecord_createdAt_idx" ON "SyncJobRecord"("createdAt");
