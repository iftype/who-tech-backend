CREATE TABLE "TeamBlog" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "blogUrl" TEXT NOT NULL,
  "rssUrl" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "rssStatus" TEXT NOT NULL DEFAULT 'unknown',
  "rssCheckedAt" DATETIME,
  "rssError" TEXT,
  "lastPostedAt" DATETIME,
  "memberId" INTEGER NOT NULL,
  "workspaceId" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "TeamBlog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TeamBlog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TeamBlog_memberId_key" ON "TeamBlog"("memberId");
CREATE UNIQUE INDEX "TeamBlog_slug_workspaceId_key" ON "TeamBlog"("slug", "workspaceId");
CREATE INDEX "TeamBlog_workspaceId_enabled_idx" ON "TeamBlog"("workspaceId", "enabled");
