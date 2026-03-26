import { Router } from 'express';
import { createOctokit } from './github.service.js';
import { syncWorkspace } from './sync.service.js';
import prisma from '../../db/prisma.js';

const router = Router();

router.get('/status', async (_req, res) => {
  const workspace = await prisma.workspace.findFirst({ where: { name: 'woowacourse' } });
  const memberCount = await prisma.member.count();
  res.json({
    memberCount,
    lastSyncAt: workspace?.updatedAt ?? null,
  });
});

router.post('/sync', async (_req, res) => {
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: 'woowacourse' } });
  const octokit = createOctokit(process.env['GITHUB_TOKEN']);

  const { totalSynced, reposSynced } = await syncWorkspace(octokit, workspace.id);

  res.json({ totalSynced, reposSynced });
});

export default router;
