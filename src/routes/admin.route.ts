import { Router } from 'express';
import { createOctokit } from '../services/github.service.js';
import { syncWorkspace } from '../services/sync.service.js';
import prisma from '../db/prisma.js';
import { adminAuth } from '../middleware/auth.js';
import type { CohortRule } from '../types/index.js';

const router = Router();
router.use(adminAuth);

router.get('/status', async (_req, res) => {
  const workspace = await prisma.workspace.findFirst({ where: { name: 'woowacourse' } });
  const memberCount = await prisma.member.count();
  res.json({
    memberCount,
    lastSyncAt: workspace?.updatedAt ?? null,
  });
});

router.get('/workspace', async (_req, res) => {
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: 'woowacourse' } });
  res.json({
    nicknameRegex: workspace.nicknameRegex,
    cohortRules: JSON.parse(workspace.cohortRules),
  });
});

router.put('/workspace', async (req, res) => {
  const { nicknameRegex, cohortRules } = req.body as {
    nicknameRegex?: string;
    cohortRules?: CohortRule[];
  };

  const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: 'woowacourse' } });

  const updated = await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      ...(nicknameRegex && { nicknameRegex }),
      ...(cohortRules && { cohortRules: JSON.stringify(cohortRules) }),
    },
  });

  res.json({
    nicknameRegex: updated.nicknameRegex,
    cohortRules: JSON.parse(updated.cohortRules),
  });
});

// 레포 목록 조회
router.get('/repos', async (_req, res) => {
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: 'woowacourse' } });
  const repos = await prisma.missionRepo.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: 'asc' },
  });
  res.json(repos);
});

// 레포 추가
router.post('/repos', async (req, res) => {
  const { name, repoUrl, track, type, nicknameRegex } = req.body as {
    name: string;
    repoUrl: string;
    track: string;
    type?: string;
    nicknameRegex?: string;
  };

  const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: 'woowacourse' } });

  const repo = await prisma.missionRepo.create({
    data: {
      name,
      repoUrl,
      track,
      type: type ?? 'individual',
      nicknameRegex: nicknameRegex ?? null,
      workspaceId: workspace.id,
    },
  });

  res.status(201).json(repo);
});

// 레포 수정 (nicknameRegex)
router.patch('/repos/:id', async (req, res) => {
  const id = Number(req.params['id']);
  if (isNaN(id)) {
    res.status(400).json({ message: 'invalid id' });
    return;
  }

  const { nicknameRegex } = req.body as { nicknameRegex: string | null };
  if (typeof nicknameRegex !== 'string' && nicknameRegex !== null) {
    res.status(400).json({ message: 'invalid nicknameRegex' });
    return;
  }

  const repo = await prisma.missionRepo.update({
    where: { id },
    data: { nicknameRegex: nicknameRegex ?? null },
  });

  res.json(repo);
});

// 레포 삭제
router.delete('/repos/:id', async (req, res) => {
  const id = Number(req.params['id']);
  if (isNaN(id)) {
    res.status(400).json({ message: 'invalid id' });
    return;
  }

  await prisma.$transaction([
    prisma.submission.deleteMany({ where: { missionRepoId: id } }),
    prisma.missionRepo.delete({ where: { id } }),
  ]);

  res.status(204).end();
});

router.post('/sync', async (_req, res) => {
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: 'woowacourse' } });
  const octokit = createOctokit(process.env['GITHUB_TOKEN']);

  const { totalSynced, reposSynced } = await syncWorkspace(octokit, workspace.id);

  res.json({ totalSynced, reposSynced });
});

export default router;
