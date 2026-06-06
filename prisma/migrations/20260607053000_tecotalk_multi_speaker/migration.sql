-- TecoTalk 다인 발표자(M:N) 전환. (데이터 없음 → 드롭 후 재생성)

DROP TABLE IF EXISTS "TecoTalk";

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
    "workspaceId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TecoTalk_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TecoTalk_videoId_key" ON "TecoTalk"("videoId");
CREATE INDEX "TecoTalk_workspaceId_uploadedAt_idx" ON "TecoTalk"("workspaceId", "uploadedAt");
CREATE INDEX "TecoTalk_cohort_idx" ON "TecoTalk"("cohort");
CREATE INDEX "TecoTalk_matchStatus_idx" ON "TecoTalk"("matchStatus");

CREATE TABLE "TecoTalkSpeaker" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tecoTalkId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    CONSTRAINT "TecoTalkSpeaker_tecoTalkId_fkey" FOREIGN KEY ("tecoTalkId") REFERENCES "TecoTalk" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TecoTalkSpeaker_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TecoTalkSpeaker_tecoTalkId_memberId_key" ON "TecoTalkSpeaker"("tecoTalkId", "memberId");
CREATE INDEX "TecoTalkSpeaker_memberId_idx" ON "TecoTalkSpeaker"("memberId");
