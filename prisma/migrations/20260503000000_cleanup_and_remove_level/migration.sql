ALTER TABLE "CohortRepo" ADD COLUMN "level" INTEGER;

PRAGMA foreign_keys=OFF;

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
    "syncMode" TEXT NOT NULL DEFAULT 'continuous',
    "lastSyncAt" DATETIME,
    "workspaceId" INTEGER NOT NULL
);

INSERT INTO "new_MissionRepo" (
    "id", "githubRepoId", "name", "repoUrl", "description", "track", 
    "type", "tabCategory", "status", "candidateReason", "cohorts", 
    "syncMode", "lastSyncAt", "workspaceId"
) SELECT 
    "id", "githubRepoId", "name", "repoUrl", "description", "track", 
    "type", "tabCategory", "status", "candidateReason", "cohorts", 
    "syncMode", "lastSyncAt", "workspaceId"
FROM "MissionRepo";

DROP TABLE "MissionRepo";
ALTER TABLE "new_MissionRepo" RENAME TO "MissionRepo";

CREATE UNIQUE INDEX "MissionRepo_githubRepoId_key" ON "MissionRepo"("githubRepoId");
CREATE UNIQUE INDEX "MissionRepo_name_workspaceId_key" ON "MissionRepo"("name", "workspaceId");

PRAGMA foreign_keys=ON;
