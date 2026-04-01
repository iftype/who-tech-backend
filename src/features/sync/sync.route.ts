import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
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

  router.get('/sync/continuous/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    service
      .syncContinuous((step) => send('progress', step))
      .then((result) => {
        send('done', result);
        res.end();
      })
      .catch((err: unknown) => {
        send('error', { message: err instanceof Error ? err.message : 'sync failed' });
        res.end();
      });
  });

  router.get('/sync/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const cohort = typeof req.query['cohort'] === 'string' ? Number(req.query['cohort']) : undefined;

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    service
      .syncWorkspace((step) => send('progress', step), cohort && !Number.isNaN(cohort) ? cohort : undefined)
      .then((result) => {
        send('done', result);
        res.end();
      })
      .catch((err: unknown) => {
        send('error', { message: err instanceof Error ? err.message : 'sync failed' });
        res.end();
      });
  });

  return router;
}
