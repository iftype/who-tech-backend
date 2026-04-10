import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ESM 환경에서는 jest.unstable_mockModule + 동적 import 순서가 중요
const mockFetchRepoPRs = jest.fn();
const mockFetchUserBlogCandidates = jest.fn();
const mockProbeRss = jest.fn();

jest.unstable_mockModule('../../features/sync/github.service.js', () => ({
  fetchRepoPRs: mockFetchRepoPRs,
  fetchUserBlogCandidates: mockFetchUserBlogCandidates,
  // detectCohort는 순수 함수라 실제 구현 위임
  detectCohort: (date: Date, rules: { year: number; cohort: number }[]) => {
    const year = date.getFullYear();
    return rules.find((r) => r.year === year)?.cohort ?? null;
  },
}));

jest.unstable_mockModule('../../features/blog/blog.service.js', () => ({
  probeRss: mockProbeRss,
}));

const { createSyncService } = await import('../../features/sync/sync.service.js');

// ─── 픽스처 헬퍼 ────────────────────────────────────────────────────────────

const COHORT_RULES = [
  { year: 2026, cohort: 8 },
  { year: 2025, cohort: 7 },
];

const makePR = (
  overrides: Partial<{
    number: number;
    html_url: string;
    title: string;
    state: 'open' | 'closed';
    merged_at: string | null;
    user: { login: string; id?: number } | null;
    created_at: string;
  }> = {},
) => ({
  number: 1,
  html_url: 'https://github.com/woowacourse/java-racingcar/pull/1',
  title: '[1단계] 콘티 미션 제출합니다.',
  state: 'open' as const,
  merged_at: null,
  user: { login: 'testuser', id: 9001 },
  base: { ref: 'testuser' },
  created_at: '2026-03-01T00:00:00Z',
  ...overrides,
});

const makeMember = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  githubId: 'testuser',
  githubUserId: 9001,
  nickname: '콘티',
  manualNickname: null,
  nicknameStats: null,
  blog: null,
  avatarUrl: null,
  profileFetchedAt: null,
  profileRefreshError: null,
  previousGithubIds: null,
  ...overrides,
});

const makeProfile = (overrides: Record<string, unknown> = {}) => ({
  profile: {
    githubId: 'testuser',
    githubUserId: 9001,
    avatarUrl: 'https://avatars.githubusercontent.com/u/9001',
  },
  candidates: ['https://velog.io/@testuser'],
  ...overrides,
});

const makeRepo = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  name: 'java-racingcar',
  track: 'backend' as string | null,
  lastSyncAt: null,
  ...overrides,
});

function makeDeps(overrides: Record<string, Record<string, jest.Mock>> = {}) {
  return {
    memberRepo: {
      findByGithubUserId: jest.fn().mockResolvedValue(null as never),
      findByGithubId: jest.fn().mockResolvedValue(null as never),
      upsert: jest.fn().mockResolvedValue(makeMember() as never),
      upsertParticipation: jest.fn().mockResolvedValue(undefined as never),
      ...overrides['memberRepo'],
    },
    missionRepoRepo: {
      touch: jest.fn().mockResolvedValue(undefined as never),
      findMany: jest.fn().mockResolvedValue([] as never),
      ...overrides['missionRepoRepo'],
    },
    submissionRepo: {
      upsert: jest.fn().mockResolvedValue(undefined as never),
      ...overrides['submissionRepo'],
    },
    workspaceRepo: {
      findByIdOrThrow: jest.fn().mockResolvedValue({
        id: 1,
        githubOrg: 'woowacourse',
        cohortRules: JSON.stringify(COHORT_RULES),
      } as never),
      touch: jest.fn().mockResolvedValue(undefined as never),
      ...overrides['workspaceRepo'],
    },
    bannedWordRepo: {
      findAll: jest.fn().mockResolvedValue([] as never),
      ...overrides['bannedWordRepo'],
    },
    ignoredDomainRepo: {
      findAll: jest.fn().mockResolvedValue([] as never),
      ...overrides['ignoredDomainRepo'],
    },
    activityLogService: {
      addLog: jest.fn().mockResolvedValue(undefined as never),
      ...overrides['activityLogService'],
    },
  };
}

// ─── syncRepo ────────────────────────────────────────────────────────────────

describe('syncRepo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchRepoPRs.mockResolvedValue([] as never);
    mockFetchUserBlogCandidates.mockResolvedValue(makeProfile() as never);
    mockProbeRss.mockResolvedValue({ status: 'available' } as never);
  });

  it('PR 없으면 synced=0, failures=[] 반환', async () => {
    const deps = makeDeps();
    const { syncRepo } = createSyncService(deps as never);

    const result = await syncRepo({} as never, 1, 'woowacourse', makeRepo(), COHORT_RULES);

    expect(result).toEqual({ synced: 0, failures: [] });
    expect(deps.missionRepoRepo.touch).toHaveBeenCalledWith(10);
  });

  it('PR 파싱 → member upsert → submission upsert 기본 흐름', async () => {
    mockFetchRepoPRs.mockResolvedValue([makePR()] as never);
    const deps = makeDeps();
    const { syncRepo } = createSyncService(deps as never);

    const result = await syncRepo({} as never, 1, 'woowacourse', makeRepo(), COHORT_RULES);

    expect(result.synced).toBe(1);
    expect(result.failures).toHaveLength(0);
    expect(deps.memberRepo.upsert).toHaveBeenCalledTimes(1);
    expect(deps.submissionRepo.upsert).toHaveBeenCalledTimes(1);
  });

  it('공통 미션(track=null) + 미지의 멤버 → 스킵', async () => {
    mockFetchRepoPRs.mockResolvedValue([makePR()] as never);
    const deps = makeDeps();
    const { syncRepo } = createSyncService(deps as never);

    const result = await syncRepo({} as never, 1, 'woowacourse', makeRepo({ track: null }), COHORT_RULES);

    expect(result.synced).toBe(0);
    expect(deps.memberRepo.upsert).not.toHaveBeenCalled();
    expect(deps.submissionRepo.upsert).not.toHaveBeenCalled();
  });

  it('공통 미션(track=null) + 기존 멤버 → submission 연결', async () => {
    mockFetchRepoPRs.mockResolvedValue([makePR()] as never);
    const existing = makeMember({
      blog: 'https://velog.io/@testuser',
      avatarUrl: 'https://avatars.test/1',
      profileFetchedAt: new Date(),
    });
    const deps = makeDeps({
      memberRepo: {
        findByGithubUserId: jest.fn().mockResolvedValue(existing as never),
        findByGithubId: jest.fn().mockResolvedValue(existing as never),
        upsert: jest.fn().mockResolvedValue(existing as never),
        upsertParticipation: jest.fn().mockResolvedValue(undefined as never),
      },
    });
    const { syncRepo } = createSyncService(deps as never);

    const result = await syncRepo({} as never, 1, 'woowacourse', makeRepo({ track: null }), COHORT_RULES);

    expect(result.synced).toBe(1);
    expect(deps.submissionRepo.upsert).toHaveBeenCalledTimes(1);
  });

  it('금지어 토큰은 nicknameStats에 포함되지 않는다', async () => {
    mockFetchRepoPRs.mockResolvedValue([makePR({ title: '[1단계] 콘티 제출합니다.' })] as never);
    const existing = makeMember();
    const deps = makeDeps({
      memberRepo: {
        findByGithubUserId: jest.fn().mockResolvedValue(existing as never),
        findByGithubId: jest.fn().mockResolvedValue(existing as never),
        upsert: jest.fn().mockResolvedValue(existing as never),
        upsertParticipation: jest.fn().mockResolvedValue(undefined as never),
      },
      bannedWordRepo: {
        findAll: jest.fn().mockResolvedValue([{ word: '제출합니다' }] as never),
      },
    });
    const { syncRepo } = createSyncService(deps as never);

    await syncRepo({} as never, 1, 'woowacourse', makeRepo(), COHORT_RULES);

    const upsertArgs = (deps.memberRepo.upsert as jest.Mock).mock.calls[0] as unknown[];
    const data = upsertArgs[2] as { nicknameStats: string };
    const nicknames = (JSON.parse(data.nicknameStats) as Array<{ nickname: string }>).map((s) => s.nickname);
    expect(nicknames).toContain('콘티');
    expect(nicknames).not.toContain('제출합니다');
  });

  it('같은 githubUserId면 fetchUserBlogCandidates를 한 번만 호출한다 (캐시)', async () => {
    mockFetchRepoPRs.mockResolvedValue([makePR({ number: 1 }), makePR({ number: 2 })] as never);
    const deps = makeDeps();
    const { syncRepo } = createSyncService(deps as never);

    await syncRepo({} as never, 1, 'woowacourse', makeRepo(), COHORT_RULES);

    expect(mockFetchUserBlogCandidates).toHaveBeenCalledTimes(1);
  });

  it('다른 githubUserId면 각각 fetchUserBlogCandidates를 호출한다', async () => {
    mockFetchRepoPRs.mockResolvedValue([
      makePR({ number: 1, user: { login: 'user-a', id: 1001 } }),
      makePR({ number: 2, user: { login: 'user-b', id: 1002 } }),
    ] as never);
    mockFetchUserBlogCandidates
      .mockResolvedValueOnce({
        profile: { githubId: 'user-a', githubUserId: 1001, avatarUrl: null },
        candidates: [],
      } as never)
      .mockResolvedValueOnce({
        profile: { githubId: 'user-b', githubUserId: 1002, avatarUrl: null },
        candidates: [],
      } as never);
    const deps = makeDeps();
    const { syncRepo } = createSyncService(deps as never);

    await syncRepo({} as never, 1, 'woowacourse', makeRepo(), COHORT_RULES);

    expect(mockFetchUserBlogCandidates).toHaveBeenCalledTimes(2);
  });

  it('blog/avatarUrl 있고 최근 profileFetchedAt이면 프로필 재fetch 안 함', async () => {
    mockFetchRepoPRs.mockResolvedValue([makePR()] as never);
    const existing = makeMember({
      blog: 'https://velog.io/@testuser',
      avatarUrl: 'https://avatars.test/1',
      profileFetchedAt: new Date(),
    });
    const deps = makeDeps({
      memberRepo: {
        findByGithubUserId: jest.fn().mockResolvedValue(existing as never),
        findByGithubId: jest.fn().mockResolvedValue(existing as never),
        upsert: jest.fn().mockResolvedValue(existing as never),
        upsertParticipation: jest.fn().mockResolvedValue(undefined as never),
      },
    });
    const { syncRepo } = createSyncService(deps as never);

    await syncRepo({} as never, 1, 'woowacourse', makeRepo(), COHORT_RULES);

    expect(mockFetchUserBlogCandidates).not.toHaveBeenCalled();
  });

  it('ghost 계정은 기존 githubId를 유지한다', async () => {
    mockFetchRepoPRs.mockResolvedValue([makePR()] as never);
    mockFetchUserBlogCandidates.mockResolvedValue({
      profile: { githubId: 'ghost', githubUserId: null, avatarUrl: null },
      candidates: [],
    } as never);
    const deps = makeDeps();
    const { syncRepo } = createSyncService(deps as never);

    await syncRepo({} as never, 1, 'woowacourse', makeRepo(), COHORT_RULES);

    const upsertArgs = (deps.memberRepo.upsert as jest.Mock).mock.calls[0] as unknown[];
    const data = upsertArgs[2] as { githubId: string };
    expect(data.githubId).toBe('testuser');
  });

  it('fetchRepoPRs 실패 시 HttpError(500)를 throw한다', async () => {
    mockFetchRepoPRs.mockRejectedValue(new Error('network error') as never);
    const deps = makeDeps();
    const { syncRepo } = createSyncService(deps as never);

    await expect(syncRepo({} as never, 1, 'woowacourse', makeRepo(), COHORT_RULES)).rejects.toMatchObject({
      statusCode: 500,
      message: expect.stringContaining('java-racingcar'),
    });
  });

  it('개별 PR 처리 실패 시 failures에 추가하고 나머지 PR은 계속 처리한다', async () => {
    mockFetchRepoPRs.mockResolvedValue([
      makePR({ number: 1, user: { login: 'user-a', id: 9001 } }),
      makePR({ number: 2, user: { login: 'user-b', id: 9002 } }),
    ] as never);
    mockFetchUserBlogCandidates
      .mockResolvedValueOnce({
        profile: { githubId: 'user-a', githubUserId: 9001, avatarUrl: null },
        candidates: [],
      } as never)
      .mockResolvedValueOnce({
        profile: { githubId: 'user-b', githubUserId: 9002, avatarUrl: null },
        candidates: [],
      } as never);
    let upsertCount = 0;
    const deps = makeDeps({
      submissionRepo: {
        upsert: jest.fn().mockImplementation(async () => {
          upsertCount++;
          if (upsertCount === 1) throw new Error('db constraint error');
        }),
      },
    });
    const { syncRepo } = createSyncService(deps as never);

    const result = await syncRepo({} as never, 1, 'woowacourse', makeRepo(), COHORT_RULES);

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.prNumber).toBe(1);
    expect(result.synced).toBe(1);
  });

  it('onProgress가 파싱 완료 → PR별 처리 → 완료 순으로 호출된다', async () => {
    mockFetchRepoPRs.mockResolvedValue([
      makePR({ number: 1 }),
      makePR({ number: 2, user: { login: 'user-b', id: 9002 } }),
    ] as never);
    mockFetchUserBlogCandidates
      .mockResolvedValueOnce({
        profile: { githubId: 'testuser', githubUserId: 9001, avatarUrl: null },
        candidates: [],
      } as never)
      .mockResolvedValueOnce({
        profile: { githubId: 'user-b', githubUserId: 9002, avatarUrl: null },
        candidates: [],
      } as never);
    const deps = makeDeps();
    const { syncRepo } = createSyncService(deps as never);
    const steps: { total: number; processed: number; percent: number; phase: string }[] = [];

    await syncRepo({} as never, 1, 'woowacourse', makeRepo(), COHORT_RULES, (s) => steps.push(s));

    expect(steps[0]?.phase).toBe('PR 파싱 완료');
    expect(steps[steps.length - 1]?.percent).toBe(100);
    expect(steps[steps.length - 1]?.phase).toBe('완료');
  });

  it('PR 없을 때 onProgress가 100%로 호출된다', async () => {
    const deps = makeDeps();
    const { syncRepo } = createSyncService(deps as never);
    const steps: { percent: number }[] = [];

    await syncRepo({} as never, 1, 'woowacourse', makeRepo(), COHORT_RULES, (s) => steps.push(s));

    expect(steps[0]?.percent).toBe(100);
  });
});

// ─── syncWorkspace ───────────────────────────────────────────────────────────

describe('syncWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchRepoPRs.mockResolvedValue([] as never);
    mockFetchUserBlogCandidates.mockResolvedValue(makeProfile() as never);
    mockProbeRss.mockResolvedValue({ status: 'available' } as never);
  });

  it('active 레포를 syncMode·lastSyncAt에 관계없이 모두 sync한다 (candidate는 제외)', async () => {
    const deps = makeDeps({
      missionRepoRepo: {
        touch: jest.fn().mockResolvedValue(undefined as never),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            name: 'repo-target',
            track: 'backend',
            status: 'active',
            syncMode: 'once',
            lastSyncAt: null,
            cohorts: '[]',
          },
          {
            id: 2,
            name: 'repo-already-synced',
            track: 'backend',
            status: 'active',
            syncMode: 'once',
            lastSyncAt: new Date(),
            cohorts: '[]',
          },
          {
            id: 3,
            name: 'repo-continuous',
            track: 'backend',
            status: 'active',
            syncMode: 'continuous',
            lastSyncAt: null,
            cohorts: '[]',
          },
          {
            id: 4,
            name: 'repo-candidate',
            track: 'backend',
            status: 'candidate',
            syncMode: 'once',
            lastSyncAt: null,
            cohorts: '[]',
          },
        ] as never),
      },
    });
    const { syncWorkspace } = createSyncService(deps as never);
    const steps: { repo: string }[] = [];

    await syncWorkspace({} as never, 1, (s) => steps.push(s));

    expect(steps.map((s) => s.repo)).toEqual(['repo-target', 'repo-already-synced', 'repo-continuous']);
    expect(deps.workspaceRepo.touch).toHaveBeenCalledWith(1);
  });

  it('cohort 파라미터로 해당 기수 레포만 필터링한다', async () => {
    const deps = makeDeps({
      missionRepoRepo: {
        touch: jest.fn().mockResolvedValue(undefined as never),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            name: 'repo-8',
            track: 'backend',
            status: 'active',
            syncMode: 'once',
            lastSyncAt: null,
            cohorts: '[8]',
          },
          {
            id: 2,
            name: 'repo-7',
            track: 'backend',
            status: 'active',
            syncMode: 'once',
            lastSyncAt: null,
            cohorts: '[7]',
          },
        ] as never),
      },
    });
    const { syncWorkspace } = createSyncService(deps as never);
    const steps: { repo: string }[] = [];

    await syncWorkspace({} as never, 1, (s) => steps.push(s), 8);

    expect(steps.map((s) => s.repo)).toEqual(['repo-8']);
  });

  it('cohortRules 빈 배열이면 cohort=null로 처리돼 upsertParticipation이 호출되지 않는다', async () => {
    mockFetchRepoPRs.mockResolvedValue([makePR()] as never);
    const deps = makeDeps({
      workspaceRepo: {
        findByIdOrThrow: jest.fn().mockResolvedValue({
          id: 1,
          githubOrg: 'woowacourse',
          cohortRules: '[]',
        } as never),
        touch: jest.fn().mockResolvedValue(undefined as never),
      },
      missionRepoRepo: {
        touch: jest.fn().mockResolvedValue(undefined as never),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            name: 'repo-a',
            track: 'backend',
            status: 'active',
            syncMode: 'once',
            lastSyncAt: null,
            cohorts: '[]',
          },
        ] as never),
      },
    });
    const { syncWorkspace } = createSyncService(deps as never);

    await syncWorkspace({} as never, 1);

    expect(deps.memberRepo.upsertParticipation).not.toHaveBeenCalled();
  });
});
