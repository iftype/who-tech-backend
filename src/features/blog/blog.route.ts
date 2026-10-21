import { Router } from 'express';
import { NotFoundError } from '../../shared/errors.js';
import { badRequest } from '../../shared/http.js';
import type { SyncAdminService } from '../sync/index.js';
import type { BlogAdminService } from './blog.admin.service.js';
import { listBlogSyncJobs, toBlogSyncJob } from './blog.sync-jobs.js';

export function createBlogRouter(service: BlogAdminService, syncAdminService: SyncAdminService) {
  const router = Router();

  // 1. 블로그 동기화: 싱크 큐(블로그 레인)에 넣는다. 이미 대기·실행 중이면 그 작업을 돌려준다 (30분 cron이 겹쳐도 하나만)
  router.post('/blog/sync', async (req, res) => {
    const source = req.get('X-Sync-Source') === 'github-actions' ? 'github-actions' : 'manual';
    const active = syncAdminService.findActiveJob('blog');
    const jobId = active?.id ?? syncAdminService.createJob('blog', { blogSource: source });
    const job = syncAdminService.getJob(jobId);
    if (!job) throw new NotFoundError('blog sync job not found');
    res.status(202).json(toBlogSyncJob(job));
  });

  router.get('/blog/sync-jobs', async (_req, res) => {
    res.json(listBlogSyncJobs(syncAdminService));
  });

  router.get('/blog/sync-jobs/:jobId', async (req, res) => {
    const jobId = req.params['jobId'];
    if (!jobId || Array.isArray(jobId)) {
      return badRequest('invalid job id');
    }
    const job = syncAdminService.getJob(jobId);
    if (!job || job.type !== 'blog') throw new NotFoundError('blog sync job not found');
    res.json(toBlogSyncJob(job));
  });

  // 2. 최근 새 블로그 글 조회 (sinceMinutes 이내 createdAt 기준)
  router.get('/blog/new-posts', async (req, res) => {
    const sinceMinutesValue = req.query['sinceMinutes'];
    const sinceMinutes = typeof sinceMinutesValue === 'string' ? Number(sinceMinutesValue) : 65;
    res.json(await service.getNewPosts(Number.isFinite(sinceMinutes) && sinceMinutes > 0 ? sinceMinutes : 65));
  });

  router.get('/blog/team', async (_req, res) => {
    res.json(await service.getTeamBlogStatus());
  });

  router.post('/blog/team/sync', async (_req, res) => {
    res.json(await service.syncTeamBlogs());
  });

  router.patch('/blog/team/:id', async (req, res) => {
    const id = Number(req.params['id']);
    if (!Number.isInteger(id) || id < 1) return badRequest('invalid team blog id');
    const body = req.body as {
      name?: unknown;
      blogUrl?: unknown;
      rssUrl?: unknown;
      avatarUrl?: unknown;
      enabled?: unknown;
    };
    res.json(
      await service.updateTeamBlog(id, {
        ...(typeof body.name === 'string' ? { name: body.name } : {}),
        ...(typeof body.blogUrl === 'string' ? { blogUrl: body.blogUrl } : {}),
        ...(typeof body.rssUrl === 'string' ? { rssUrl: body.rssUrl } : {}),
        ...(body.avatarUrl === null || typeof body.avatarUrl === 'string' ? { avatarUrl: body.avatarUrl } : {}),
        ...(typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}),
      }),
    );
  });

  // 3. 블로그 링크 백필 (RSS 후보 검사 및 자동 등록)
  router.post('/blog/backfill', async (req, res) => {
    // Limit 처리
    const limitValue = req.query['limit'];
    const limit = typeof limitValue === 'string' ? Number(limitValue) : 30;
    if (Number.isNaN(limit) || limit < 1 || limit > 50) {
      return badRequest('invalid limit');
    }

    // Cohort 처리 (Exact Optional 대응)
    const cohortValue = req.query['cohort'];
    const cohortNum = typeof cohortValue === 'string' ? Number(cohortValue) : NaN;

    // NaN이거나 값이 없으면 undefined를 확실히 넘김
    const cohort = !Number.isNaN(cohortNum) ? cohortNum : undefined;

    // 서비스 호출
    // 서비스 내부에서 ...(cohort !== undefined ? { cohort } : {}) 로 처리되므로
    // 여기서 undefined를 넘겨도 안전합니다.
    res.json(await service.backfillWorkspaceBlogLinks(limit, cohort));
  });

  return router;
}
