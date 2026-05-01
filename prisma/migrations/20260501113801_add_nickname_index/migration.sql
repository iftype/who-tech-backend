-- CreateIndex
CREATE INDEX "BlogPost_memberId_publishedAt_idx" ON "BlogPost"("memberId", "publishedAt");

-- CreateIndex
CREATE INDEX "Member_workspaceId_nickname_idx" ON "Member"("workspaceId", "nickname");
