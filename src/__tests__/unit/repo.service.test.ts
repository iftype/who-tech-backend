import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { createRepoService } from '../../features/repo/repo.service.js';

// ─── 픽스처 헬퍼 ──────────────────────────────────────────────────────────────

const makeRepo = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  name: 'java-racingcar',
  track: 'backend' as string | null,
  status: 'active',
  syncMode: 'continuous',
  lastSyncAt: null,
  repoUrl: 'https://github.com/woowacourse/java-racingcar',
  githubRepoId: null,
  description: null,
  type: 'individual',
  tabCategory: 'base',
  cohorts: '[]',
  level: null,
  workspaceId: 1,
  candidateReason: null,
  ...overrides,
});

const makeSyncContext = () => ({
  id: 1,
  githubOrg: 'woowacourse',
  cohortRules: [{ year: 2026, cohort: 8 }],
});

function makeDeps(
  overrides: {
    syncRepoImpl?: () => Promise<{ synced: number; failures: [] }>;
  } = {},
) {
  const syncRepoImpl =
    overrides.syncRepoImpl ??
    jest.fn<() => Promise<{ synced: number; failures: [] }>>().mockResolvedValue({ synced: 0, failures: [] });

  return {
    missionRepoRepo: {
      findByIdOrThrow: jest.fn<() => Promise<ReturnType<typeof makeRepo>>>().mockResolvedValue(makeRepo()),
      findMany: jest.fn().mockResolvedValue([] as never),
      create: jest.fn().mockResolvedValue(makeRepo() as never),
      update: jest.fn().mockResolvedValue(makeRepo() as never),
      findFirst: jest.fn().mockResolvedValue(null as never),
      deleteWithSubmissions: jest.fn().mockResolvedValue(undefined as never),
      deleteAllWithSubmissions: jest.fn().mockResolvedValue(undefined as never),
    },
    workspaceService: {
      getOrThrow: jest.fn().mockResolvedValue({ id: 1, githubOrg: 'woowacourse' } as never),
      getSyncContext: jest.fn<() => Promise<ReturnType<typeof makeSyncContext>>>().mockResolvedValue(makeSyncContext()),
    },
    syncService: {
      syncRepo: jest.fn().mockImplementation(syncRepoImpl as never),
    },
    octokit: {} as never,
  };
}

// ─── enqueueRepoSyncById ──────────────────────────────────────────────────────

describe('enqueueRepoSyncById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('같은 repoId로 두 번 호출 시 기존 running job을 반환하고 새 job을 생성하지 않는다', async () => {
    // syncRepo가 완료되지 않도록 pending Promise 사용
    let resolveSync!: () => void;
    const syncPending = new Promise<{ synced: number; failures: [] }>((resolve) => {
      resolveSync = () => resolve({ synced: 0, failures: [] });
    });

    const deps = makeDeps({ syncRepoImpl: () => syncPending });
    const service = createRepoService(deps as never);

    const job1 = await service.enqueueRepoSyncById(10);
    // await 사이에 microtask가 flush되어 syncRepo가 호출되지만 pending 상태 유지
    const job2 = await service.enqueueRepoSyncById(10);

    // 두 호출 모두 같은 job을 반환해야 함
    expect(job1.id).toBe(job2.id);

    // syncRepo는 첫 번째 enqueue에서 한 번만 호출되어야 함 (새 job 생성 없음)
    expect(deps.syncService.syncRepo).toHaveBeenCalledTimes(1);

    // cleanup
    resolveSync();
    await syncPending.catch(() => null);
  });

  it('sync 완료 후 runningRepoJobs에서 제거되어 다음 호출 시 새 job이 생성된다', async () => {
    const deps = makeDeps();
    const service = createRepoService(deps as never);

    const job1 = await service.enqueueRepoSyncById(10);

    // 비동기 sync 실행 완료 대기 (microtask + syncRepo Promise 처리)
    await Promise.resolve();
    // syncRepo 자체는 mockResolvedValue이므로 한 번 더 flush
    await new Promise((resolve) => setTimeout(resolve, 0));

    const job2 = await service.enqueueRepoSyncById(10);

    expect(job1.id).not.toBe(job2.id);
    expect(deps.syncService.syncRepo).toHaveBeenCalledTimes(2);
  });
});
