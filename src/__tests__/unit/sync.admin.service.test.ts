import { describe, expect, it, jest } from '@jest/globals';
import { createSyncAdminService } from '../../features/sync/sync.admin.service.js';

describe('createSyncAdminService', () => {
  it('기수 목록에 등록된 레포를 순서대로 전체 재sync한다', async () => {
    const cohortRepoRepo = {
      findByCohort: jest.fn().mockResolvedValue([
        {
          order: 1,
          missionRepo: { id: 11, name: 'java-racingcar', track: 'backend' },
        },
        {
          order: 2,
          missionRepo: { id: 12, name: 'java-lotto', track: null },
        },
      ] as never),
    };
    const workspaceService = {
      getOrThrow: jest.fn(),
      getSyncContext: jest.fn().mockResolvedValue({
        id: 7,
        githubOrg: 'woowacourse',
        cohortRules: [{ year: 2026, cohort: 8 }],
      } as never),
    };
    const syncService = {
      syncWorkspace: jest.fn(),
      syncContinuousRepos: jest.fn(),
      syncRepo: jest
        .fn()
        .mockResolvedValueOnce({ synced: 3, failures: [] } as never)
        .mockResolvedValueOnce({ synced: 1, failures: [] } as never),
    };

    const service = createSyncAdminService({
      cohortRepoRepo: cohortRepoRepo as never,
      memberRepo: { count: jest.fn() } as never,
      missionRepoRepo: { count: jest.fn() } as never,
      workspaceService: workspaceService as never,
      syncService: syncService as never,
      octokit: {} as never,
    });

    const steps: { repo: string; done: number; total: number; synced: number }[] = [];
    const result = await service.syncCohortRepoList(8, (step) => steps.push(step));

    expect(workspaceService.getSyncContext).toHaveBeenCalledTimes(1);
    expect(cohortRepoRepo.findByCohort).toHaveBeenCalledWith(7, 8);
    expect(syncService.syncRepo).toHaveBeenNthCalledWith(
      1,
      {},
      7,
      'woowacourse',
      { id: 11, name: 'java-racingcar', track: 'backend', lastSyncAt: null },
      [{ year: 2026, cohort: 8 }],
    );
    expect(syncService.syncRepo).toHaveBeenNthCalledWith(
      2,
      {},
      7,
      'woowacourse',
      { id: 12, name: 'java-lotto', track: null, lastSyncAt: null },
      [{ year: 2026, cohort: 8 }],
    );
    expect(steps).toEqual([
      { repo: 'java-racingcar', done: 1, total: 2, synced: 3 },
      { repo: 'java-lotto', done: 2, total: 2, synced: 1 },
    ]);
    expect(result).toEqual({ totalSynced: 4, reposSynced: 2 });
  });
});
