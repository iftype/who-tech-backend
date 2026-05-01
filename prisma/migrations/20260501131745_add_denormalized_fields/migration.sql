-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN "cohort" INTEGER;
ALTER TABLE "BlogPost" ADD COLUMN "track" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN "workspaceId" INTEGER;

-- CreateTable
CREATE TABLE "PreviousGithubId" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "githubId" TEXT NOT NULL,
    "memberId" INTEGER NOT NULL,
    CONSTRAINT "PreviousGithubId_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PreviousGithubId_githubId_idx" ON "PreviousGithubId"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "PreviousGithubId_githubId_memberId_key" ON "PreviousGithubId"("githubId", "memberId");

-- CreateIndex
CREATE INDEX "BlogPost_workspaceId_publishedAt_idx" ON "BlogPost"("workspaceId", "publishedAt");

-- CreateIndex
CREATE INDEX "BlogPost_cohort_publishedAt_idx" ON "BlogPost"("cohort", "publishedAt");

-- CreateIndex
CREATE INDEX "BlogPost_track_publishedAt_idx" ON "BlogPost"("track", "publishedAt");

-- CreateIndex
CREATE INDEX "Member_githubId_idx" ON "Member"("githubId");
