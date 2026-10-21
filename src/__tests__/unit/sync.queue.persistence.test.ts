import { describe, it, expect, jest } from '@jest/globals';
import { createSyncQueue } from '../../features/sync/sync.queue.js';
import type { SyncJobRecordData } from '../../db/repositories/sync-job.repository.js';

// 큐는 메모리에서 돌고, 상태가 바뀔 때마다 기록한다. 부팅 때는 끝을 못 적은 기록을 닫고 최근 기록을 되살린다
function makeRepo(rows: SyncJobRecordData[] = []) {
  return {
    upsert: jest.fn(async (data: SyncJobRecordData) => data),
    findRecent: jest.fn(async () => rows),
    closeUnfinished: jest.fn(async () => 1),
    deleteCompletedBefore: jest.fn(async () => 0),
  };
}

function makeQueue(repo: ReturnType<typeof makeRepo>) {
  const syncService = { syncWorkspace: jest.fn(async () => ({ totalSynced: 2, reposSynced: 1 })) };
  const queue = createSyncQueue({
    syncService: syncService as never,
    activityLogService: { addLog: jest.fn(async () => undefined) } as never,
    workspaceService: { getOrThrow: jest.fn(async () => ({ id: 1 })) } as never,
    octokit: {} as never,
    repoService: { executeRepoSync: jest.fn() } as never,
    blogAdminService: { executeWorkspaceBlogSync: jest.fn() } as never,
    syncJobRepo: repo as never,
  });
  return { queue, syncService };
}

async function waitDone(queue: ReturnType<typeof makeQueue>['queue'], id: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    const status = queue.getJob(id)?.status;
    if (status === 'completed' || status === 'failed' || status === 'cancelled') return;
    await new Promise((r) => setImmediate(r));
  }
  throw new Error('job did not finish');
}

describe('createSyncQueue persistence', () => {
  it('should record every status transition of a job', async () => {
    const repo = makeRepo();
    const { queue } = makeQueue(repo);

    const id = queue.enqueue('workspace', { cohort: 8, quiet: true });
    await waitDone(queue, id);
    await new Promise((r) => setImmediate(r));

    expect(repo.upsert.mock.calls.map(([row]) => row.status)).toEqual(['queued', 'running', 'completed']);
    const last = repo.upsert.mock.calls.at(-1)![0];
    expect(last).toMatchObject({ id, type: 'workspace', lane: 'github', cohort: 8, quiet: true, error: null });
    expect(JSON.parse(last.result!)).toEqual({ totalSynced: 2, reposSynced: 1 });
    expect(last.completedAt).toBeInstanceOf(Date);
  });

  it('should keep running when recording fails', async () => {
    const repo = makeRepo();
    repo.upsert.mockRejectedValue(new Error('db locked'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { queue } = makeQueue(repo);

    const id = queue.enqueue('workspace');
    await waitDone(queue, id);

    expect(queue.getJob(id)?.status).toBe('completed');
  });

  it('should close unfinished records and restore recent ones without running them', async () => {
    const createdAt = new Date('2026-10-22T00:00:00Z');
    const repo = makeRepo([
      {
        id: 'old-1',
        type: 'blog',
        lane: 'blog',
        status: 'completed',
        cohort: null,
        repoId: null,
        githubId: null,
        blogSource: 'github-actions',
        label: null,
        quiet: false,
        error: null,
        result: JSON.stringify({ totalSynced: 5, reposSynced: 1 }),
        detail: JSON.stringify({ blogResult: { synced: 5, deleted: 0, failures: [] } }),
        createdAt,
        startedAt: createdAt,
        completedAt: new Date(createdAt.getTime() + 1000),
      },
      {
        id: 'old-2',
        type: 'workspace',
        lane: 'github',
        status: 'failed',
        cohort: 8,
        repoId: null,
        githubId: null,
        blogSource: null,
        label: null,
        quiet: true,
        error: 'server restarted',
        result: null,
        detail: null,
        createdAt: new Date(createdAt.getTime() + 2000),
        startedAt: new Date(createdAt.getTime() + 2000),
        completedAt: new Date(createdAt.getTime() + 3000),
      },
    ]);
    const { queue, syncService } = makeQueue(repo);

    const restored = await queue.restore();

    expect(restored).toBe(2);
    expect(repo.closeUnfinished).toHaveBeenCalledWith('server restarted', expect.any(Date));
    expect(queue.getJobs().map((j) => [j.id, j.status])).toEqual([
      ['old-1', 'completed'],
      ['old-2', 'failed'],
    ]);
    expect(queue.getJob('old-1')).toMatchObject({
      blogSource: 'github-actions',
      result: { totalSynced: 5, reposSynced: 1 },
      blogResult: { synced: 5, deleted: 0, failures: [] },
    });
    expect(queue.getJob('old-2')).toMatchObject({ cohort: 8, quiet: true, error: 'server restarted' });
    expect(syncService.syncWorkspace).not.toHaveBeenCalled();
    expect(queue.findActive('workspace', { cohort: 8 })).toBeUndefined();

    // 되살린 뒤 새 작업은 뒤에 붙는다
    const id = queue.enqueue('workspace');
    await waitDone(queue, id);
    expect(queue.getJobs().map((j) => j.id)).toEqual(['old-1', 'old-2', id]);
  });

  it('should restore nothing without a repository', async () => {
    const queue = createSyncQueue({
      syncService: {} as never,
      activityLogService: { addLog: jest.fn(async () => undefined) } as never,
      workspaceService: { getOrThrow: jest.fn(async () => ({ id: 1 })) } as never,
      octokit: {} as never,
      repoService: {} as never,
      blogAdminService: {} as never,
    });
    await expect(queue.restore()).resolves.toBe(0);
  });
});
