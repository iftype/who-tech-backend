-- SQLite: Workspace에서 nicknameRegex 제거 (테이블 재생성 필요)
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Workspace" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "githubOrg" TEXT NOT NULL,
    "cohortRules" TEXT NOT NULL,
    "blogSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Workspace" ("id","name","githubOrg","cohortRules","blogSyncEnabled","createdAt","updatedAt")
SELECT "id","name","githubOrg","cohortRules","blogSyncEnabled","createdAt","updatedAt" FROM "Workspace";
DROP TABLE "Workspace";
ALTER TABLE "new_Workspace" RENAME TO "Workspace";
CREATE UNIQUE INDEX "Workspace_name_key" ON "Workspace"("name");

-- MissionRepo에서 nicknameRegex, cohortRegexRules 제거
CREATE TABLE "new_MissionRepo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "githubRepoId" INTEGER,
    "name" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "description" TEXT,
    "track" TEXT,
    "type" TEXT NOT NULL DEFAULT 'individual',
    "tabCategory" TEXT NOT NULL DEFAULT 'base',
    "status" TEXT NOT NULL DEFAULT 'active',
    "candidateReason" TEXT,
    "cohorts" TEXT,
    "level" INTEGER,
    "syncMode" TEXT NOT NULL DEFAULT 'continuous',
    "lastSyncAt" DATETIME,
    "workspaceId" INTEGER NOT NULL,
    CONSTRAINT "MissionRepo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MissionRepo" ("id","githubRepoId","name","repoUrl","description","track","type","tabCategory","status","candidateReason","cohorts","level","syncMode","lastSyncAt","workspaceId")
SELECT "id","githubRepoId","name","repoUrl","description","track","type","tabCategory","status","candidateReason","cohorts","level","syncMode","lastSyncAt","workspaceId" FROM "MissionRepo";
DROP TABLE "MissionRepo";
ALTER TABLE "new_MissionRepo" RENAME TO "MissionRepo";
CREATE UNIQUE INDEX "MissionRepo_githubRepoId_key" ON "MissionRepo"("githubRepoId");
CREATE UNIQUE INDEX "MissionRepo_name_workspaceId_key" ON "MissionRepo"("name", "workspaceId");

PRAGMA foreign_keys=ON;

-- NicknameBannedWord 테이블 생성
CREATE TABLE "NicknameBannedWord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "word" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NicknameBannedWord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NicknameBannedWord_word_workspaceId_key" ON "NicknameBannedWord"("word", "workspaceId");

-- IgnoredDomain 테이블 생성
CREATE TABLE "IgnoredDomain" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "domain" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IgnoredDomain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "IgnoredDomain_domain_workspaceId_key" ON "IgnoredDomain"("domain", "workspaceId");
