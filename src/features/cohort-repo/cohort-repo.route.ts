import { Router } from 'express';
import { badRequest } from '../../shared/http.js';

import { parseId, parseNumberQuery } from '../../shared/validation.js';
import type { CohortRepoService } from './cohort-repo.service.js';

export function createCohortRepoRouter(service: CohortRepoService) {
  const router = Router();

  router.get('/cohorts', async (_req, res) => {
    res.json(await service.listCohorts());
  });

  router.get('/', async (req, res) => {
    const cohort = parseNumberQuery(req.query['cohort']);
    if (Number.isNaN(cohort)) badRequest('cohort required');
    res.json(await service.listByCohort(cohort));
  });

  router.post('/auto-fill', async (req, res) => {
    const cohort = typeof req.body?.cohort === 'number' ? req.body.cohort : NaN;
    if (Number.isNaN(cohort)) badRequest('cohort required');
    res.json(await service.autoFill(cohort));
  });

  router.post('/', async (req, res) => {
    const { cohort, missionRepoId, order, level } = req.body as {
      cohort: number;
      missionRepoId: number;
      order?: number;
      level?: number | null;
    };
    if (!cohort || !missionRepoId) badRequest('cohort and missionRepoId required');
    res.status(201).json(await service.create({ cohort, missionRepoId, order: order ?? 0, level: level ?? null }));
  });

  router.patch('/:id', async (req, res) => {
    const { order, level } = req.body as { order?: number; level?: number | null };
    res.json(
      await service.update(parseId(req.params['id']), {
        ...(order !== undefined ? { order } : {}),
        ...(level !== undefined ? { level } : {}),
      }),
    );
  });

  router.delete('/:id', async (req, res) => {
    await service.delete(parseId(req.params['id']));
    res.status(204).end();
  });

  return router;
}
