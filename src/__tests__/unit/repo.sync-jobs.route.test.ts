import { describe, it, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createRepoRouter } from '../../features/repo/repo.route.js';
import { createSyncQueue } from '../../features/sync/sync.queue.js';
import { errorHandler } from '../../shared/middleware/error.js';

// 어드민 레포 탭의 "레포 싱크" 버튼: POST로 큐에 넣고 GET /sync-jobs/:id 를 폴링한다.
// 예전에는 GET이 아무도 채우지 않는 별도 저장소를 읽어 항상 404였다 → 큐에서 읽는지 실제 큐로 고정한다
function makeApp() {
  let finish: (v: { synced: number; failures: [] }) => void = () => undefined;
  const executeRepoSync = jest.fn(
    (
      _id: number,
      onProgress?: (p: { total: number; processed: number; synced: number; percent: number; phase: string }) => void,
    ) =>
      new Promise<{ synced: number; failures: [] }>((resolve) => {
        onProgress?.({ total: 10, processed: 5, synced: 4, percent: 50, phase: 'PR 처리 중' });
        finish = resolve;
      }),
  );
  const queue = createSyncQueue({
    syncService: {} as never,
    activityLogService: { addLog: jest.fn(async () => undefined) } as never,
    workspaceService: { getOrThrow: jest.fn(async () => ({ id: 1 })) } as never,
    octokit: {} as never,
    repoService: { executeRepoSync } as never,
    blogAdminService: {} as never,
  });
  const syncAdminService = {
    createJob: queue.enqueue,
    getJob: queue.getJob,
    getJobs: queue.getJobs,
  };
  const repoService = { findRepoName: jest.fn(async (id: number) => (id === 10 ? 'java-racingcar' : null)) };
  const app = express();
  app.use('/admin/repos', createRepoRouter(repoService as never, syncAdminService as never));
  app.use(errorHandler);
  return { app, queue, finish: (v: { synced: number; failures: [] }) => finish(v) };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('repo sync jobs route', () => {
  it('should let the admin poll a repo sync until it completes', async () => {
    const { app, finish } = makeApp();

    const created = await request(app).post('/admin/repos/10/sync');
    expect(created.status).toBe(202);
    await flush();

    const running = await request(app).get(`/admin/repos/sync-jobs/${created.body.id}`);
    expect(running.status).toBe(200);
    expect(running.body).toMatchObject({
      id: created.body.id,
      repoId: 10,
      repoName: 'java-racingcar',
      status: 'running',
      message: 'java-racingcar sync PR 처리 중 (5/10)',
      progress: { total: 10, processed: 5, synced: 4, percent: 50, phase: 'PR 처리 중' },
      result: null,
      error: null,
      finishedAt: null,
    });

    finish({ synced: 4, failures: [] });
    await flush();
    await flush();

    const done = await request(app).get(`/admin/repos/sync-jobs/${created.body.id}`);
    expect(done.body).toMatchObject({
      status: 'completed',
      message: 'java-racingcar sync 완료',
      result: { synced: 4, failures: [] },
    });
    expect(done.body.finishedAt).not.toBeNull();
  });

  it('should list only repo jobs, newest first', async () => {
    const { app, queue } = makeApp();
    queue.enqueue('continuous');
    const first = (await request(app).post('/admin/repos/10/sync')).body.id;
    await new Promise((r) => setTimeout(r, 5));
    const second = (await request(app).post('/admin/repos/11/sync')).body.id;

    const res = await request(app).get('/admin/repos/sync-jobs');

    expect(res.status).toBe(200);
    expect(res.body.map((j: { id: string }) => j.id)).toEqual([second, first]);
    expect(res.body[0]).toMatchObject({ repoId: 11, repoName: '', status: 'queued', message: 'repo#11 sync 대기 중' });
  });

  it('should answer 404 for an unknown job or a non-repo job', async () => {
    const { app, queue } = makeApp();
    const other = queue.enqueue('continuous');
    expect((await request(app).get('/admin/repos/sync-jobs/nope')).status).toBe(404);
    const res = await request(app).get(`/admin/repos/sync-jobs/${other}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'sync job not found' });
  });
});
