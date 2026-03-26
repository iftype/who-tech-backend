import { Router } from 'express';
import prisma from '../../db/prisma.js';
import type { CohortRule } from '../../shared/types/index.js';

const router = Router();

router.get('/', async (_req, res) => {
  const workspace = await prisma.workspace.findFirstOrThrow({ where: { name: 'woowacourse' } });
  res.json({
    nicknameRegex: workspace.nicknameRegex,
    cohortRules: JSON.parse(workspace.cohortRules),
  });
});

router.put('/', async (req, res) => {
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

export default router;
