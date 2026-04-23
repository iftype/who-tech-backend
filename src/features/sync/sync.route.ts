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

  router.get(
    '/github-status',
    asyncHandler(async (_req, res) => {
      res.json(await service.getGithubStatus());
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

  // --- Job Queue Endpoints ---

  router.post(
    '/sync/jobs',
    asyncHandler(async (req, res) => {
      const type = req.body?.type as string | undefined;
      const cohort = typeof req.body?.cohort === 'number' ? req.body.cohort : undefined;

      if (type !== 'workspace' && type !== 'continuous' && type !== 'cohort-repos') {
        res.status(400).json({ error: 'type must be workspace, continuous, or cohort-repos' });
        return;
      }

      if (type === 'cohort-repos' && cohort == null) {
        res.status(400).json({ error: 'cohort is required for cohort-repos job' });
        return;
      }

      const id = service.createJob(type, cohort);
      const job = service.getJob(id);
      res.status(201).json(job);
    }),
  );

  router.get(
    '/sync/jobs',
    asyncHandler(async (_req, res) => {
      res.json(service.getJobs());
    }),
  );

  router.delete(
    '/sync/jobs/:id',
    asyncHandler(async (req, res) => {
      const success = service.cancelJob(String(req.params['id'] ?? ''));
      if (!success) {
        res.status(404).json({ error: 'job not found or already completed' });
        return;
      }
      res.json({ success: true });
    }),
  );

  router.get('/sync/jobs/:id/stream', (req, res) => {
    const jobId = String(req.params['id'] ?? '');
    const job = service.getJob(jobId);

    if (!job) {
      res.status(404).json({ error: 'job not found' });
      return;
    }

    const send = startSse(res);

    if (job.progress) {
      send('progress', job.progress);
    }

    if (job.status === 'completed') {
      send('done', job.result ?? {});
      res.end();
      return;
    }

    if (job.status === 'failed') {
      send('error', { message: job.error ?? 'unknown error' });
      res.end();
      return;
    }

    if (job.status === 'cancelled') {
      send('error', { message: 'cancelled' });
      res.end();
      return;
    }

    const unsubProgress = service.subscribeProgress(jobId, (step) => {
      send('progress', step);
    });

    const jobDonePromise = new Promise<unknown>((resolve) => {
      const unsubDone = service.subscribeDone(jobId, (completedJob) => {
        unsubDone();
        resolve(completedJob);
      });
    });

    runSseJob(
      res,
      send,
      jobDonePromise.then((completedJob) => {
        unsubProgress();
        const j = completedJob as { status: string; result?: unknown; error?: string };
        if (j.status === 'cancelled') {
          throw new Error('cancelled');
        }
        return j.result ?? {};
      }),
    );
  });

  return router;
}
