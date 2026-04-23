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
      getOrThrow: jest.fn().mockResolvedValue({
        id: 7,
        githubOrg: 'woowacourse',
        cohortRules: JSON.stringify([{ year: 2026, cohort: 8 }]),
        updatedAt: new Date(),
        profileRefreshEnabled: true,
        lastProfileRefreshAt: null,
      } as never),
      getSyncContext: jest.fn().mockResolvedValue({
        id: 7,
        githubOrg: 'woowacourse',
        cohortRules: [{ year: 2026, cohort: 8 }],
      } as never),
    };
    const syncService = {
      syncWorkspace: jest.fn(),
      syncContinuousRepos: jest.fn(),
      syncCohortRepoList: jest.fn().mockResolvedValue({ totalSynced: 4, reposSynced: 2 } as never),
      syncRepo: jest
        .fn()
        .mockResolvedValueOnce({ synced: 3, failures: [] } as never)
        .mockResolvedValueOnce({ synced: 1, failures: [] } as never),
    };
    const activityLogService = {
      addLog: jest.fn().mockResolvedValue(undefined as never),
    };

    const service = createSyncAdminService({
      cohortRepoRepo: cohortRepoRepo as never,
      memberRepo: { count: jest.fn() } as never,
      missionRepoRepo: { count: jest.fn() } as never,
      workspaceService: workspaceService as never,
      syncService: syncService as never,
      activityLogService: activityLogService as never,
      octokit: {} as never,
    });

    const result = await service.syncCohortRepoList(8);

    expect(syncService.syncCohortRepoList).toHaveBeenCalledWith({}, 7, 8, undefined);
    expect(result).toEqual({ totalSynced: 4, reposSynced: 2 });
  });
});
