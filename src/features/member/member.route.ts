import { Router } from 'express';
import prisma from '../../db/prisma.js';
import { WORKSPACE_NAME } from '../../shared/constants.js';

const router = Router();

router.get('/', async (_req, res) => {
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: WORKSPACE_NAME } });
  const members = await prisma.member.findMany({
    where: { workspaceId: workspace.id },
    orderBy: [{ cohort: 'desc' }, { nickname: 'asc' }],
    include: {
      _count: { select: { submissions: true } },
      blogPosts: { orderBy: { publishedAt: 'desc' }, take: 1 },
    },
  });
  res.json(members);
});

export default router;
