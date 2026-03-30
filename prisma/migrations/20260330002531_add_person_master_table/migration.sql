-- CreateTable
CREATE TABLE "Person" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "displayName" TEXT,
    "note" TEXT,
    "workspaceId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Person_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "githubUserId" INTEGER,
    "githubId" TEXT NOT NULL,
    "previousGithubIds" TEXT,
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
    "workspaceId" INTEGER NOT NULL,
    "personId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Member_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Member_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("avatarUrl", "blog", "createdAt", "githubId", "githubUserId", "id", "lastPostedAt", "manualNickname", "nickname", "nicknameStats", "previousGithubIds", "profileFetchedAt", "profileRefreshError", "rssCheckedAt", "rssError", "rssStatus", "rssUrl", "updatedAt", "workspaceId") SELECT "avatarUrl", "blog", "createdAt", "githubId", "githubUserId", "id", "lastPostedAt", "manualNickname", "nickname", "nicknameStats", "previousGithubIds", "profileFetchedAt", "profileRefreshError", "rssCheckedAt", "rssError", "rssStatus", "rssUrl", "updatedAt", "workspaceId" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE UNIQUE INDEX "Member_githubId_workspaceId_key" ON "Member"("githubId", "workspaceId");
CREATE UNIQUE INDEX "Member_githubUserId_workspaceId_key" ON "Member"("githubUserId", "workspaceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
