import { Router } from 'express';
import { asyncHandler, HttpError } from '../../shared/http.js';
import { parseId } from '../../shared/validation.js';
import { parseRepoCreateInput, parseRepoUpdateInput } from './repo.validation.js';
import type { RepoService } from './repo.service.js';
import type { SyncAdminService } from '../sync/index.js';
import { listRepoSyncJobs, toRepoSyncJob } from './repo.sync-jobs.js';

export function createRepoRouter(service: RepoService, syncAdminService: SyncAdminService) {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const status = typeof req.query['status'] === 'string' ? req.query['status'] : undefined;
      res.json(await service.listRepos(status));
    }),
  );

  router.post(
    '/discover',
    asyncHandler(async (_req, res) => {
      res.json(await service.refreshRepoCandidates());
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      res.status(201).json(await service.createRepo(parseRepoCreateInput(req.body)));
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      res.json(await service.updateRepoMatchingRules(parseId(req.params['id']), parseRepoUpdateInput(req.body)));
    }),
  );

  router.post(
    '/:id/sync',
    asyncHandler(async (req, res) => {
      const repoId = parseId(req.params['id']);
      const repoName = await service.findRepoName(repoId);
      const jobId = syncAdminService.createJob('repo', undefined, repoId, undefined, repoName ?? undefined);
      const job = syncAdminService.getJob(jobId);
      res.status(202).json(job);
    }),
  );

  router.post(
    '/:id/reset-sync',
    asyncHandler(async (req, res) => {
      await service.resetRepoSyncStatus(parseId(req.params['id']));
      res.status(204).end();
    }),
  );

  router.get(
    '/sync-jobs',
    asyncHandler(async (_req, res) => {
      res.json(listRepoSyncJobs(syncAdminService));
    }),
  );

  router.get(
    '/sync-jobs/:jobId',
    asyncHandler(async (req, res) => {
      const jobId = req.params['jobId'];
      if (!jobId || Array.isArray(jobId)) {
        throw new HttpError(400, 'invalid job id');
      }
      const job = syncAdminService.getJob(jobId);
      if (!job || job.type !== 'repo') {
        throw new HttpError(404, 'sync job not found');
      }
      res.json(toRepoSyncJob(job));
    }),
  );

  router.delete(
    '/',
    asyncHandler(async (_req, res) => {
      await service.deleteAllRepos();
      res.status(204).end();
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await service.deleteRepo(parseId(req.params['id']));
      res.status(204).end();
    }),
  );

  return router;
}
