-- AlterTable: BlogPost 내부 클릭(조회)수 추가
ALTER TABLE "BlogPost" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TecoTalk" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "speakerNickname" TEXT,
    "uploadedAt" DATETIME NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "cohort" INTEGER,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "memberId" INTEGER,
    "workspaceId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TecoTalk_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TecoTalk_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TecoTalk_videoId_key" ON "TecoTalk"("videoId");

-- CreateIndex
CREATE INDEX "TecoTalk_workspaceId_uploadedAt_idx" ON "TecoTalk"("workspaceId", "uploadedAt");

-- CreateIndex
CREATE INDEX "TecoTalk_memberId_idx" ON "TecoTalk"("memberId");

-- CreateIndex
CREATE INDEX "TecoTalk_cohort_idx" ON "TecoTalk"("cohort");

-- CreateIndex
CREATE INDEX "TecoTalk_matchStatus_idx" ON "TecoTalk"("matchStatus");
