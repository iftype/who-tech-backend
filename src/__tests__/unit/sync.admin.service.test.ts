import { describe, expect, it, jest } from '@jest/globals';
import { createSyncAdminService } from '../../features/sync/sync.admin.service.js';
import { CancelledError } from '../../shared/errors.js';

type Result = { totalSynced: number; reposSynced: number };

// 끝나는 시점을 테스트가 정하는 싱크 (resolve를 부르기 전까지 작업이 실행 중으로 남는다)
function deferred() {
  let resolve!: (value: Result) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Result>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeService(requestWaitMs?: number) {
  const syncService = {
    syncWorkspace: jest.fn<(...args: unknown[]) => Promise<Result>>(async () => ({ totalSynced: 1, reposSynced: 1 })),
    syncContinuousRepos: jest.fn<(...args: unknown[]) => Promise<Result>>(async () => ({
      totalSynced: 2,
      reposSynced: 1,
    })),
    syncCohortRepoList: jest.fn<(...args: unknown[]) => Promise<Result>>(async () => ({
      totalSynced: 4,
      reposSynced: 2,
    })),
  };
  const addLog = jest.fn(async (..._args: unknown[]) => undefined);
  const service = createSyncAdminService({
    cohortRepoRepo: {} as never,
    memberRepo: { count: jest.fn() } as never,
    missionRepoRepo: { count: jest.fn() } as never,
    workspaceService: { getOrThrow: jest.fn(async () => ({ id: 7 })) } as never,
    syncService: syncService as never,
    activityLogService: { addLog } as never,
    octokit: {} as never,
    repoService: { executeRepoSync: jest.fn() } as never,
    blogAdminService: { executeWorkspaceBlogSync: jest.fn() } as never,
    ...(requestWaitMs != null ? { requestWaitMs } : {}),
  });
  return { service, syncService, addLog };
}

describe('createSyncAdminService — 직접 싱크도 큐를 거친다', () => {
  it('should run the cohort sync as a queue job and return its result', async () => {
    const { service, syncService } = makeService();

    const result = await service.syncCohortRepoList(8);

    expect(result).toEqual({ totalSynced: 4, reposSynced: 2 });
    expect(syncService.syncCohortRepoList).toHaveBeenCalledWith(
      {},
      7,
      8,
      expect.any(Function),
      expect.any(AbortSignal),
    );
    expect(service.getJobs()).toEqual([
      expect.objectContaining({ type: 'cohort-repos', cohort: 8, status: 'completed' }),
    ]);
  });

  it('should forward queue progress to the SSE callback', async () => {
    const { service, syncService } = makeService();
    syncService.syncWorkspace.mockImplementationOnce(async (...args: unknown[]) => {
      const onProgress = args[2] as (step: { repo: string; done: number; total: number; synced: number }) => void;
      onProgress({ repo: 'java-lotto', done: 1, total: 2, synced: 3 });
      return { totalSynced: 3, reposSynced: 1 };
    });
    const steps: unknown[] = [];

    await service.syncWorkspace((step) => steps.push(step));

    expect(steps).toEqual([{ repo: 'java-lotto', done: 1, total: 2, synced: 3 }]);
  });

  it('should not start a direct sync while another queue job is running', async () => {
    const { service, syncService } = makeService();
    const running = deferred();
    syncService.syncWorkspace.mockImplementationOnce(() => running.promise);

    service.createJob('workspace');
    const continuous = service.syncContinuous();
    await new Promise((r) => setImmediate(r));
    expect(syncService.syncContinuousRepos).not.toHaveBeenCalled();

    running.resolve({ totalSynced: 1, reposSynced: 1 });
    await expect(continuous).resolves.toEqual({ totalSynced: 2, reposSynced: 1 });
  });

  it('should join an active job of the same kind instead of queueing it twice', async () => {
    const { service, syncService } = makeService();
    const running = deferred();
    syncService.syncContinuousRepos.mockImplementationOnce(() => running.promise);

    const first = service.requestSync('continuous');
    const second = service.requestSync('continuous');
    running.resolve({ totalSynced: 5, reposSynced: 2 });

    const done = { done: true, result: { totalSynced: 5, reposSynced: 2 } };
    await expect(first).resolves.toEqual(done);
    await expect(second).resolves.toEqual(done);
    expect(syncService.syncContinuousRepos).toHaveBeenCalledTimes(1);
    expect(service.getJobs()).toHaveLength(1);
  });

  it('should queue a separate job for a different cohort', async () => {
    const { service, syncService } = makeService();

    await Promise.all([service.requestSync('workspace', 7), service.requestSync('workspace', 8)]);

    expect(syncService.syncWorkspace).toHaveBeenCalledTimes(2);
  });

  it('should return the queued job when it does not finish within the request wait', async () => {
    const { service, syncService } = makeService(10);
    const running = deferred();
    syncService.syncWorkspace.mockImplementationOnce(() => running.promise);
    service.createJob('workspace');

    const outcome = await service.requestSync('continuous');

    expect(outcome).toEqual({ done: false, job: expect.objectContaining({ type: 'continuous', status: 'queued' }) });
    running.resolve({ totalSynced: 1, reposSynced: 1 });
  });

  it('should fail with the original error when the job fails', async () => {
    const { service, syncService } = makeService();
    const error = new Error('github timeout');
    syncService.syncContinuousRepos.mockRejectedValueOnce(error);

    await expect(service.requestSync('continuous')).rejects.toBe(error);
  });

  it('should fail with CancelledError when the job is cancelled', async () => {
    const { service, syncService } = makeService();
    const running = deferred();
    syncService.syncWorkspace.mockImplementationOnce(() => running.promise);
    service.createJob('workspace');

    const waiting = service.syncContinuous();
    const queued = service.getJobs().find((j) => j.type === 'continuous');
    service.cancelJob(queued!.id);
    running.resolve({ totalSynced: 1, reposSynced: 1 });

    await expect(waiting).rejects.toBeInstanceOf(CancelledError);
  });

  it('should not add queued or completed logs for direct syncs, but keep failure logs', async () => {
    const { service, syncService, addLog } = makeService();

    await service.requestSync('continuous');
    expect(addLog).not.toHaveBeenCalled();

    syncService.syncContinuousRepos.mockRejectedValueOnce(new Error('github timeout'));
    await expect(service.requestSync('continuous')).rejects.toThrow('github timeout');
    expect(addLog).toHaveBeenCalledWith('sync_error', 'Job failed: continuous — github timeout');
  });

  it('should keep logging jobs created from the admin queue panel', async () => {
    const { service, addLog } = makeService();

    const id = service.createJob('continuous');
    await expect(service.getQueue().waitFor(id)).resolves.toEqual({ totalSynced: 2, reposSynced: 1 });

    expect(addLog).toHaveBeenCalledWith('sync', expect.stringContaining('Job queued: continuous'));
    expect(addLog).toHaveBeenCalledWith('sync', expect.stringContaining('Job completed: continuous'));
  });
});
