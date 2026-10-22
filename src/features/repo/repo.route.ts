import { Router } from 'express';
import { HttpError } from '../../shared/http.js';
import { parseId } from '../../shared/validation.js';
import { parseRepoCreateInput, parseRepoUpdateInput } from './repo.validation.js';
import type { RepoService } from './repo.service.js';
import type { SyncAdminService } from '../sync/index.js';
import { listRepoSyncJobs, toRepoSyncJob } from './repo.sync-jobs.js';

export function createRepoRouter(service: RepoService, syncAdminService: SyncAdminService) {
  const router = Router();

  router.get('/', async (req, res) => {
    const status = typeof req.query['status'] === 'string' ? req.query['status'] : undefined;
    res.json(await service.listRepos(status));
  });

  router.post('/discover', async (_req, res) => {
    res.json(await service.refreshRepoCandidates());
  });

  // 최근 PR 활동으로 미분류 추가·continuous 전환 (#236). 서버 crontab이 1시간마다
  router.post('/activity', async (_req, res) => {
    res.json(await service.refreshRepoActivity());
  });

  router.post('/', async (req, res) => {
    res.status(201).json(await service.createRepo(parseRepoCreateInput(req.body)));
  });

  router.patch('/:id', async (req, res) => {
    res.json(await service.updateRepoMatchingRules(parseId(req.params['id']), parseRepoUpdateInput(req.body)));
  });

  router.post('/:id/sync', async (req, res) => {
    const repoId = parseId(req.params['id']);
    const repoName = await service.findRepoName(repoId);
    const jobId = syncAdminService.createJob('repo', { repoId, ...(repoName ? { label: repoName } : {}) });
    const job = syncAdminService.getJob(jobId);
    res.status(202).json(job);
  });

  router.post('/:id/reset-sync', async (req, res) => {
    await service.resetRepoSyncStatus(parseId(req.params['id']));
    res.status(204).end();
  });

  router.get('/sync-jobs', async (_req, res) => {
    res.json(listRepoSyncJobs(syncAdminService));
  });

  router.get('/sync-jobs/:jobId', async (req, res) => {
    const jobId = req.params['jobId'];
    if (!jobId || Array.isArray(jobId)) {
      throw new HttpError(400, 'invalid job id');
    }
    const job = syncAdminService.getJob(jobId);
    if (!job || job.type !== 'repo') {
      throw new HttpError(404, 'sync job not found');
    }
    res.json(toRepoSyncJob(job));
  });

  router.delete('/', async (_req, res) => {
    await service.deleteAllRepos();
    res.status(204).end();
  });

  router.delete('/:id', async (req, res) => {
    await service.deleteRepo(parseId(req.params['id']));
    res.status(204).end();
  });

  return router;
}
