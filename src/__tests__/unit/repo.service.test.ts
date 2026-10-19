import { describe, expect, it, jest } from '@jest/globals';
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

// ─── findRepoName ─────────────────────────────────────────────────────────────

describe('findRepoName', () => {
  it('should return the repo name', async () => {
    const service = createRepoService(makeDeps() as never);
    await expect(service.findRepoName(10)).resolves.toBe('java-racingcar');
  });

  it('should return null for a missing repo instead of throwing', async () => {
    const deps = makeDeps();
    deps.missionRepoRepo.findByIdOrThrow.mockRejectedValue(new Error('not found'));
    const service = createRepoService(deps as never);
    await expect(service.findRepoName(999)).resolves.toBeNull();
  });
});
