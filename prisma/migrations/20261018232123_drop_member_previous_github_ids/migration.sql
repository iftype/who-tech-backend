/*
  Warnings:

  - You are about to drop the column `previousGithubIds` on the `Member` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "githubUserId" INTEGER,
    "githubId" TEXT NOT NULL,
    "nickname" TEXT,
    "manualNickname" TEXT,
    "nicknameStats" TEXT,
    "avatarUrl" TEXT,
    "profileFetchedAt" DATETIME,
    "profileRefreshError" TEXT,
    "blog" TEXT,
    "rssStatus" TEXT NOT NULL DEFAULT 'unknown',
    "rssUrl" TEXT,
    "rssCheckedAt" DATETIME,
    "rssError" TEXT,
    "lastPostedAt" DATETIME,
    "isTeamBlog" BOOLEAN NOT NULL DEFAULT false,
    "track" TEXT,
    "cohortLocked" BOOLEAN NOT NULL DEFAULT false,
    "workspaceId" INTEGER NOT NULL,
    "personId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Member_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Member_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("avatarUrl", "blog", "cohortLocked", "createdAt", "githubId", "githubUserId", "id", "isTeamBlog", "lastPostedAt", "manualNickname", "nickname", "nicknameStats", "personId", "profileFetchedAt", "profileRefreshError", "rssCheckedAt", "rssError", "rssStatus", "rssUrl", "track", "updatedAt", "workspaceId") SELECT "avatarUrl", "blog", "cohortLocked", "createdAt", "githubId", "githubUserId", "id", "isTeamBlog", "lastPostedAt", "manualNickname", "nickname", "nicknameStats", "personId", "profileFetchedAt", "profileRefreshError", "rssCheckedAt", "rssError", "rssStatus", "rssUrl", "track", "updatedAt", "workspaceId" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE INDEX "Member_workspaceId_nickname_idx" ON "Member"("workspaceId", "nickname");
CREATE INDEX "Member_githubId_idx" ON "Member"("githubId");
CREATE UNIQUE INDEX "Member_githubId_workspaceId_key" ON "Member"("githubId", "workspaceId");
CREATE UNIQUE INDEX "Member_githubUserId_workspaceId_key" ON "Member"("githubUserId", "workspaceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
