/*
  Warnings:

  - Added the required column `workspaceId` to the `BlogPost` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BlogPost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "memberId" INTEGER NOT NULL,
    "cohort" INTEGER,
    "track" TEXT,
    "workspaceId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlogPost_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BlogPost" ("createdAt", "id", "memberId", "publishedAt", "title", "url") SELECT "createdAt", "id", "memberId", "publishedAt", "title", "url" FROM "BlogPost";
DROP TABLE "BlogPost";
ALTER TABLE "new_BlogPost" RENAME TO "BlogPost";
CREATE UNIQUE INDEX "BlogPost_url_key" ON "BlogPost"("url");
CREATE INDEX "BlogPost_publishedAt_idx" ON "BlogPost"("publishedAt");
CREATE INDEX "BlogPost_memberId_publishedAt_idx" ON "BlogPost"("memberId", "publishedAt");
CREATE INDEX "BlogPost_workspaceId_publishedAt_idx" ON "BlogPost"("workspaceId", "publishedAt");
CREATE INDEX "BlogPost_cohort_publishedAt_idx" ON "BlogPost"("cohort", "publishedAt");
CREATE INDEX "BlogPost_track_publishedAt_idx" ON "BlogPost"("track", "publishedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
