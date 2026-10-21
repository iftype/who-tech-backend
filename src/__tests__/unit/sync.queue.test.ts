import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { createSyncQueue, FINISHED_JOB_TTL_MS } from '../../features/sync/sync.queue.js';

function makeQueue() {
  const syncService = {
    syncWorkspace: jest.fn(async () => ({ totalSynced: 1, reposSynced: 1 })),
    syncContinuousRepos: jest.fn(async () => ({ totalSynced: 0, reposSynced: 0 })),
    syncCohortRepoList: jest.fn(async () => ({ totalSynced: 0, reposSynced: 0 })),
    syncMemberPRs: jest.fn(async () => ({ totalSynced: 2, reposSynced: 1 })),
  };
  const blogAdminService = { executeWorkspaceBlogSync: jest.fn(async () => ({ synced: 5, deleted: 1, failures: [] })) };
  const queue = createSyncQueue({
    syncService: syncService as never,
    activityLogService: { addLog: jest.fn(async () => undefined) } as never,
    workspaceService: { getOrThrow: jest.fn(async () => ({ id: 1 })) } as never,
    octokit: {} as never,
    repoService: { executeRepoSync: jest.fn() } as never,
    blogAdminService: blogAdminService as never,
  });
  return { queue, syncService, blogAdminService };
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

    const id = queue.enqueue('repo', { repoId: 10, label: 'java-racingcar' });
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

describe('createSyncQueue lanes', () => {
  // GitHub 작업(workspace·continuous·cohort-repos·repo·member)은 한 줄, 블로그(RSS)는 자기 줄.
  // 블로그 30분 cron이 긴 전체 싱크 뒤에서 기다리지 않는다
  it('should run a blog job while a github job is still running', async () => {
    const { queue, syncService, blogAdminService } = makeQueue();
    let release: (v: { totalSynced: number; reposSynced: number }) => void = () => undefined;
    syncService.syncWorkspace.mockImplementationOnce(() => new Promise((r) => (release = r)));

    const github = queue.enqueue('workspace');
    const blog = queue.enqueue('blog', { blogSource: 'github-actions' });
    await waitDone(queue, blog);

    expect(queue.getJob(github)?.status).toBe('running');
    expect(queue.getJob(blog)).toMatchObject({
      status: 'completed',
      blogSource: 'github-actions',
      result: { totalSynced: 5, reposSynced: 1 },
      blogResult: { synced: 5, deleted: 1, failures: [] },
    });
    expect(blogAdminService.executeWorkspaceBlogSync).toHaveBeenCalledWith('github-actions', expect.any(Function));
    release({ totalSynced: 0, reposSynced: 0 });
    await waitDone(queue, github);
  });

  it('should keep github jobs sequential', async () => {
    const { queue, syncService } = makeQueue();
    let release: (v: { totalSynced: number; reposSynced: number }) => void = () => undefined;
    syncService.syncWorkspace.mockImplementationOnce(() => new Promise((r) => (release = r)));

    const first = queue.enqueue('workspace');
    const second = queue.enqueue('member', { githubId: 'crew9' });
    await new Promise((r) => setImmediate(r));

    expect(queue.getJob(second)?.status).toBe('queued');
    expect(syncService.syncMemberPRs).not.toHaveBeenCalled();
    release({ totalSynced: 0, reposSynced: 0 });
    await waitDone(queue, second);
    expect(queue.getJob(first)?.status).toBe('completed');
    expect(queue.getJob(second)).toMatchObject({ status: 'completed', githubId: 'crew9' });
    expect(syncService.syncMemberPRs).toHaveBeenCalledWith(
      {},
      1,
      'crew9',
      expect.any(Function),
      expect.any(AbortSignal),
    );
  });

  it('should find the active job by cohort or member', async () => {
    const { queue, syncService } = makeQueue();
    let release: (v: { totalSynced: number; reposSynced: number }) => void = () => undefined;
    syncService.syncWorkspace.mockImplementationOnce(() => new Promise((r) => (release = r)));

    const running = queue.enqueue('workspace', { cohort: 8 });
    const member = queue.enqueue('member', { githubId: 'crew9' });

    expect(queue.findActive('workspace', { cohort: 8 })?.id).toBe(running);
    expect(queue.findActive('workspace')).toBeUndefined();
    expect(queue.findActive('member', { githubId: 'crew9' })?.id).toBe(member);
    expect(queue.findActive('member', { githubId: 'other' })).toBeUndefined();
    await new Promise((r) => setImmediate(r)); // workspace 작업이 시작돼 release가 잡힐 때까지
    release({ totalSynced: 0, reposSynced: 0 });
    await waitDone(queue, member);
  });
});
