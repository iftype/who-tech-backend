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
