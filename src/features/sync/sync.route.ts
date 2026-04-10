import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { startSse, runSseJob } from '../../shared/sse-handler.js';
import { parseNumberQuery, parseOptionalNumberQuery } from '../../shared/validation.js';
import type { SyncAdminService } from './sync.admin.service.js';

export function createSyncRouter(service: SyncAdminService) {
  const router = Router();

  router.get(
    '/status',
    asyncHandler(async (_req, res) => {
      res.json(await service.getAdminStatus());
    }),
  );

  router.post(
    '/sync',
    asyncHandler(async (req, res) => {
      const cohort = typeof req.body?.cohort === 'number' ? req.body.cohort : undefined;
      res.json(await service.syncWorkspace(undefined, cohort));
    }),
  );

  router.post(
    '/sync/continuous',
    asyncHandler(async (_req, res) => {
      res.json(await service.syncContinuous());
    }),
  );

  router.get('/sync/continuous/stream', (_req, res) => {
    const send = startSse(res);
    runSseJob(
      res,
      send,
      service.syncContinuous((step) => send('progress', step)),
    );
  });

  router.get('/sync/stream', (req, res) => {
    const send = startSse(res);
    const cohort = parseOptionalNumberQuery(req.query['cohort']);
    runSseJob(
      res,
      send,
      service.syncWorkspace((step) => send('progress', step), cohort),
    );
  });

  router.post(
    '/sync/cohort-repos',
    asyncHandler(async (req, res) => {
      const cohort = typeof req.body?.cohort === 'number' ? req.body.cohort : NaN;
      if (Number.isNaN(cohort)) {
        res.status(400).json({ error: 'cohort required' });
        return;
      }
      res.json(await service.syncCohortRepoList(cohort));
    }),
  );

  router.get('/sync/cohort-repos/stream', (req, res) => {
    const send = startSse(res);
    const cohort = parseNumberQuery(req.query['cohort']);
    if (Number.isNaN(cohort)) {
      send('error', { message: 'cohort required' });
      res.end();
      return;
    }
    runSseJob(
      res,
      send,
      service.syncCohortRepoList(cohort, (step) => send('progress', step)),
    );
  });

  return router;
}
