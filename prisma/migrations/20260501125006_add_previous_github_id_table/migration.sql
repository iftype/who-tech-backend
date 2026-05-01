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
CREATE INDEX "Member_githubId_idx" ON "Member"("githubId");
