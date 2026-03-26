import { Router } from 'express';
import { createOctokit } from './github.service.js';
import { syncWorkspace } from './sync.service.js';
import prisma from '../../db/prisma.js';
import { WORKSPACE_NAME } from '../../shared/constants.js';

const router = Router();

router.get('/status', async (_req, res) => {
  const workspace = await prisma.workspace.findFirst({ where: { name: WORKSPACE_NAME } });
  const [memberCount, repoCount] = await Promise.all([prisma.member.count(), prisma.missionRepo.count()]);
  res.json({
    memberCount,
    repoCount,
    lastSyncAt: workspace?.updatedAt ?? null,
  });
});

router.post('/sync', async (_req, res) => {
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: WORKSPACE_NAME } });
  const octokit = createOctokit(process.env['GITHUB_TOKEN']);

  const { totalSynced, reposSynced } = await syncWorkspace(octokit, workspace.id);

  res.json({ totalSynced, reposSynced });
});

export default router;
