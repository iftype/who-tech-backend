import { describe, it, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createBlogRouter } from '../../features/blog/blog.route.js';
import { createSyncAdminService } from '../../features/sync/sync.admin.service.js';
import { errorHandler } from '../../shared/middleware/error.js';

type Progress = { total: number; processed: number; synced: number; percent: number; phase: string };
type BlogResult = { synced: number; deleted: number; failures: []; skipped?: boolean };

// blog-check.yml(30분 cron)이 POST /admin/blog/sync 로 시작하고 GET /sync-jobs/:id 의 status·message·progress 를 폴링한다.
// 블로그 싱크가 싱크 큐(블로그 레인)로 옮겨 간 뒤에도 그 응답 모양이 그대로인지 실제 큐로 고정한다
function makeApp() {
  let finish: (v: BlogResult) => void = () => undefined;
  const executeWorkspaceBlogSync = jest.fn(
    (_source: string, onProgress?: (p: Progress) => void) =>
      new Promise<BlogResult>((resolve) => {
        onProgress?.({ total: 20, processed: 5, synced: 2, percent: 25, phase: 'RSS 수집 중' });
        finish = resolve;
      }),
  );
  const syncAdminService = createSyncAdminService({
    memberRepo: { count: jest.fn() } as never,
    missionRepoRepo: { count: jest.fn() } as never,
    workspaceService: { getOrThrow: jest.fn(async () => ({ id: 1 })) } as never,
    syncService: {} as never,
    activityLogService: { addLog: jest.fn(async () => undefined) } as never,
    octokit: {} as never,
    repoService: { executeRepoSync: jest.fn() } as never,
    blogAdminService: { executeWorkspaceBlogSync } as never,
  });
  const app = express();
  app.use('/admin', createBlogRouter({} as never, syncAdminService));
  app.use(errorHandler);
  return { app, syncAdminService, executeWorkspaceBlogSync, finish: (v: BlogResult) => finish(v) };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('blog sync jobs route', () => {
  it('should let the workflow poll a blog sync until it completes', async () => {
    const { app, executeWorkspaceBlogSync, finish } = makeApp();

    const created = await request(app).post('/admin/blog/sync').set('X-Sync-Source', 'github-actions');
    expect(created.status).toBe(202);
    // 블로그 레인이 비어 있으면 응답 전에 이미 실행 중일 수 있다
    expect(created.body).toMatchObject({ id: expect.any(String), source: 'github-actions' });
    expect(['queued', 'running']).toContain(created.body.status);
    await flush();

    const running = await request(app).get(`/admin/blog/sync-jobs/${created.body.id}`);
    expect(running.status).toBe(200);
    expect(running.body).toMatchObject({
      id: created.body.id,
      source: 'github-actions',
      status: 'running',
      message: '블로그 sync RSS 수집 중 (5/20)',
      progress: { total: 20, processed: 5, synced: 2, percent: 25, phase: 'RSS 수집 중' },
      result: null,
      error: null,
      finishedAt: null,
    });
    expect(executeWorkspaceBlogSync).toHaveBeenCalledWith('github-actions', expect.any(Function));

    finish({ synced: 7, deleted: 1, failures: [] });
    await flush();
    await flush();

    const done = await request(app).get(`/admin/blog/sync-jobs/${created.body.id}`);
    expect(done.body).toMatchObject({
      status: 'completed',
      message: '블로그 sync 완료',
      result: { synced: 7, deleted: 1, failures: [] },
    });
    expect(done.body.finishedAt).not.toBeNull();
  });

  it('should return the active blog job instead of queueing a second one', async () => {
    const { app, executeWorkspaceBlogSync, finish } = makeApp();

    const first = await request(app).post('/admin/blog/sync');
    const second = await request(app).post('/admin/blog/sync');

    expect(second.status).toBe(202);
    expect(second.body.id).toBe(first.body.id);
    expect(first.body.source).toBe('manual');
    await flush();
    expect(executeWorkspaceBlogSync).toHaveBeenCalledTimes(1);
    finish({ synced: 0, deleted: 0, failures: [] });
    await flush();
  });

  it('should list only blog jobs and answer 404 for unknown or non-blog jobs', async () => {
    const { app, syncAdminService, finish } = makeApp();
    const other = syncAdminService.createJob('continuous');
    const blog = (await request(app).post('/admin/blog/sync')).body.id;

    const list = await request(app).get('/admin/blog/sync-jobs');
    expect(list.body.map((j: { id: string }) => j.id)).toEqual([blog]);
    expect((await request(app).get('/admin/blog/sync-jobs/nope')).status).toBe(404);
    const res = await request(app).get(`/admin/blog/sync-jobs/${other}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'blog sync job not found' });
    await flush();
    finish({ synced: 0, deleted: 0, failures: [] });
    await flush();
  });
});
