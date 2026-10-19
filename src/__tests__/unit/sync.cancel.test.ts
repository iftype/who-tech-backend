import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// 싱크 취소: 진행 중 취소되면 남은 레포를 건너뛰고 CancelledError로 끝난다 (문자열 'cancelled' 비교 대신 에러 타입)
const syncRepo = jest.fn<(...args: unknown[]) => Promise<{ synced: number; failures: [] }>>();
jest.unstable_mockModule('../../features/sync/sync.repo-sync.js', () => ({
  createRepoSyncer: () => ({ syncRepo }),
}));

const { createSyncService } = await import('../../features/sync/sync.service.js');
const errors = await import('../../shared/errors.js').catch(() => null);

const repos = [
  { id: 1, name: 'a', status: 'active', syncMode: 'continuous', cohorts: null, track: 'backend', lastSyncAt: null },
  { id: 2, name: 'b', status: 'active', syncMode: 'continuous', cohorts: null, track: 'backend', lastSyncAt: null },
];

function setup() {
  const addLog = jest.fn(async () => undefined);
  const service = createSyncService({
    syncWriteRepo: {} as never,
    missionRepoRepo: { findMany: jest.fn(async () => repos) } as never,
    workspaceRepo: {
      findByIdOrThrow: jest.fn(async () => ({ id: 1, githubOrg: 'org', cohortRules: '[]' })),
      touch: jest.fn(async () => undefined),
    } as never,
    bannedWordRepo: {} as never,
    ignoredDomainRepo: {} as never,
    cohortRepoRepo: {
      findByCohort: jest.fn(async () => repos.map((missionRepo, order) => ({ order, missionRepo }))),
    } as never,
    activityLogService: { addLog } as never,
  });
  return { service, addLog };
}

// 첫 레포를 처리하는 도중 사용자가 취소한다
function cancelDuringFirstRepo(controller: AbortController) {
  syncRepo.mockImplementationOnce(async () => {
    controller.abort();
    throw errors ? new errors.CancelledError() : new Error('cancelled');
  });
}

describe('sync cancellation', () => {
  beforeEach(() => syncRepo.mockReset());

  it('should stop a workspace sync with CancelledError and not log the cancel as a repo failure', async () => {
    const { service, addLog } = setup();
    const controller = new AbortController();
    cancelDuringFirstRepo(controller);

    const error = await service
      .syncWorkspace({} as never, 1, undefined, undefined, controller.signal)
      .catch((e: unknown) => e);

    expect(errors && error instanceof errors.CancelledError).toBe(true);
    expect((error as Error).message).toBe('cancelled');
    expect(syncRepo).toHaveBeenCalledTimes(1);
    expect(addLog.mock.calls.filter((c) => (c as unknown[])[0] === 'sync_error')).toHaveLength(0);
  });

  it('should stop a cohort repo sync with CancelledError', async () => {
    const { service } = setup();
    const controller = new AbortController();
    cancelDuringFirstRepo(controller);

    const error = await service
      .syncCohortRepoList({} as never, 1, 8, undefined, controller.signal)
      .catch((e: unknown) => e);

    expect(errors && error instanceof errors.CancelledError).toBe(true);
    expect(syncRepo).toHaveBeenCalledTimes(1);
  });

  it('should keep going after an ordinary repo failure', async () => {
    const { service, addLog } = setup();
    syncRepo.mockRejectedValueOnce(new Error('GitHub 502')).mockResolvedValueOnce({ synced: 2, failures: [] });

    const result = await service.syncContinuousRepos({} as never, 1);

    expect(result).toEqual({ totalSynced: 2, reposSynced: 1 });
    expect(addLog).toHaveBeenCalledWith('sync_error', 'Continuous Sync Failed: [a] - GitHub 502');
  });
});
