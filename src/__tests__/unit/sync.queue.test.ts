import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { createSyncQueue, FINISHED_JOB_TTL_MS } from '../../features/sync/sync.queue.js';

function makeQueue() {
  const syncService = {
    syncWorkspace: jest.fn(async () => ({ totalSynced: 1, reposSynced: 1 })),
    syncContinuousRepos: jest.fn(async () => ({ totalSynced: 0, reposSynced: 0 })),
    syncCohortRepoList: jest.fn(async () => ({ totalSynced: 0, reposSynced: 0 })),
  };
  const queue = createSyncQueue({
    syncService: syncService as never,
    activityLogService: { addLog: jest.fn(async () => undefined) } as never,
    workspaceService: { getOrThrow: jest.fn(async () => ({ id: 1 })) } as never,
    octokit: {} as never,
    repoService: { executeRepoSync: jest.fn() } as never,
    blogAdminService: { executeWorkspaceBlogSync: jest.fn() } as never,
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

describe('createSyncQueue', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should run a queued job to completion', async () => {
    const { queue, syncService } = makeQueue();
    const id = queue.enqueue('workspace');
    await waitDone(queue, id);
    expect(queue.getJob(id)).toMatchObject({ status: 'completed', result: { totalSynced: 1, reposSynced: 1 } });
    expect(syncService.syncWorkspace).toHaveBeenCalledTimes(1);
  });

  it('should drop finished jobs older than the TTL on the next enqueue', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
    jest.setSystemTime(new Date('2026-10-20T00:00:00Z'));
    const { queue } = makeQueue();

    const oldId = queue.enqueue('workspace');
    await waitDone(queue, oldId);

    jest.setSystemTime(new Date(Date.now() + FINISHED_JOB_TTL_MS - 1000));
    const recentId = queue.enqueue('continuous');
    await waitDone(queue, recentId);
    expect(queue.getJobs().map((j) => j.id)).toEqual([oldId, recentId]);

    jest.setSystemTime(new Date(Date.now() + 2000));
    const newId = queue.enqueue('continuous');
    await waitDone(queue, newId);

    expect(queue.getJob(oldId)).toBeUndefined();
    expect(queue.getJobs().map((j) => j.id)).toEqual([recentId, newId]);
  });

  it('should keep running and queued jobs regardless of age', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
    jest.setSystemTime(new Date('2026-10-20T00:00:00Z'));
    const { queue, syncService } = makeQueue();
    let release: (v: { totalSynced: number; reposSynced: number }) => void = () => undefined;
    syncService.syncWorkspace.mockImplementationOnce(() => new Promise((r) => (release = r)));

    const longId = queue.enqueue('workspace');
    await new Promise((r) => setImmediate(r));
    jest.setSystemTime(new Date(Date.now() + FINISHED_JOB_TTL_MS * 2));
    const nextId = queue.enqueue('continuous');

    expect(queue.getJob(longId)?.status).toBe('running');
    expect(queue.getJob(nextId)?.status).toBe('queued');
    release({ totalSynced: 0, reposSynced: 0 });
    await waitDone(queue, nextId);
  });
});

describe('createSyncQueue repo jobs', () => {
  it('should keep the label, step progress and PR failures of a repo job', async () => {
    const executeRepoSync = jest.fn(async (_id: number, onProgress?: (p: unknown) => void) => {
      await new Promise((r) => setImmediate(r)); // 구독할 틈을 준다
      onProgress?.({ total: 4, processed: 2, synced: 1, percent: 50, phase: 'PR 처리 중' });
      return { synced: 3, failures: [{ prNumber: 7, prUrl: 'u', error: 'boom' }] };
    });
    const queue = createSyncQueue({
      syncService: {} as never,
      activityLogService: { addLog: jest.fn(async () => undefined) } as never,
      workspaceService: { getOrThrow: jest.fn(async () => ({ id: 1 })) } as never,
      octokit: {} as never,
      repoService: { executeRepoSync } as never,
      blogAdminService: {} as never,
    });
    const progress: unknown[] = [];

    const id = queue.enqueue('repo', undefined, 10, undefined, 'java-racingcar');
    queue.subscribeProgress(id, (p) => progress.push(p));
    for (let i = 0; i < 50 && queue.getJob(id)?.status !== 'completed'; i++) {
      await new Promise((r) => setImmediate(r));
    }

    expect(executeRepoSync).toHaveBeenCalledWith(10, expect.any(Function));
    expect(queue.getJob(id)).toMatchObject({
      label: 'java-racingcar',
      status: 'completed',
      step: { total: 4, processed: 2, synced: 1, percent: 50, phase: 'PR 처리 중' },
      result: { totalSynced: 3, reposSynced: 1 },
      repoResult: { synced: 3, failures: [{ prNumber: 7, prUrl: 'u', error: 'boom' }] },
    });
    expect(progress).toEqual([{ repo: 'PR 처리 중', done: 2, total: 4, synced: 1 }]);
  });

  it('should mark the job failed when its handler throws', async () => {
    const { queue } = makeQueue();
    const id = queue.enqueue('cohort-repos');
    await waitDone(queue, id);
    expect(queue.getJob(id)).toMatchObject({ status: 'failed', error: 'cohort is required for cohort-repos job' });
  });

  it('should cancel a queued job without running it', async () => {
    const { queue, syncService } = makeQueue();
    let release: (v: { totalSynced: number; reposSynced: number }) => void = () => undefined;
    syncService.syncWorkspace.mockImplementationOnce(() => new Promise((r) => (release = r)));
    const first = queue.enqueue('workspace');
    const second = queue.enqueue('continuous');

    expect(queue.cancel(second)).toBe(true);
    for (let i = 0; i < 50 && syncService.syncWorkspace.mock.calls.length === 0; i++) {
      await new Promise((r) => setImmediate(r));
    }
    release({ totalSynced: 0, reposSynced: 0 });
    await waitDone(queue, first);

    expect(queue.getJob(second)?.status).toBe('cancelled');
    expect(syncService.syncContinuousRepos).not.toHaveBeenCalled();
  });
});
