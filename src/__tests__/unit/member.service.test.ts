import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Octokit } from '@octokit/rest';

// ESM 환경에서는 jest.unstable_mockModule + 동적 import 순서가 중요
const mockFetchUserProfile = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRefreshMemberProfileById = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.unstable_mockModule('../../features/sync/github.service.js', () => ({
  fetchUserProfile: mockFetchUserProfile,
  // detectCohort는 순수 함수라 실제 구현과 같게 둔다
  detectCohort: (date: Date, rules: { year: number; cohort: number }[]) =>
    rules.find((r) => r.year === date.getFullYear())?.cohort ?? null,
}));

jest.unstable_mockModule('../../features/member/member.profile-refresh.js', () => ({
  refreshMemberProfileById: mockRefreshMemberProfileById,
}));

const { createMemberService } = await import('../../features/member/member.service.js');
const { normalizeBlogUrl } = await import('../../shared/blog.js');

type Deps = Parameters<typeof createMemberService>[0];

// ─── 픽스처 ────────────────────────────────────────────────────────────────

const RULES_8_7 = [
  { year: 2026, cohort: 8 },
  { year: 2025, cohort: 7 },
];
const WORKSPACE = { id: 1, cohortRules: JSON.stringify(RULES_8_7) };

type Participation = { cohort: number; role: string };

function makeMember(overrides: Record<string, unknown> = {}, participations: Participation[] = []) {
  return {
    id: 10,
    githubId: 'crew1',
    githubUserId: 1001,
    nickname: null,
    manualNickname: null,
    nicknameStats: null,
    avatarUrl: null,
    blog: null,
    lastPostedAt: null,
    profileFetchedAt: null,
    profileRefreshError: null,
    rssStatus: 'unknown',
    rssUrl: null,
    rssCheckedAt: null,
    rssError: null,
    cohortLocked: false,
    track: null,
    memberCohorts: participations.map((p) => ({ cohort: { number: p.cohort }, role: { name: p.role } })),
    submissions: [] as unknown[],
    blogPosts: [],
    _count: { submissions: 0, blogPosts: 0 },
    ...overrides,
  };
}

function mergedSubmission(id: number, year: number) {
  return { id, status: 'merged', submittedAt: new Date(`${year}-04-01T00:00:00Z`), missionRepo: { track: 'backend' } };
}

type AsyncMock = ReturnType<typeof jest.fn<(...args: unknown[]) => Promise<unknown>>>;
const asyncMock = (value: unknown): AsyncMock =>
  jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(value);

function makeDeps(cohortRules: unknown = WORKSPACE.cohortRules) {
  const memberRepo = {
    findWithFilters: asyncMock([]),
    findByGithubId: asyncMock(null),
    findByGithubUserId: asyncMock(null),
    findByIdWithRelations: asyncMock(null),
    create: asyncMock({ id: 10 }),
    update: asyncMock({}),
    upsertParticipation: asyncMock({}),
    deleteParticipationsByCohort: asyncMock({}),
    deleteWithRelations: asyncMock({ id: 10 }),
    deleteAllWithRelations: asyncMock({ count: 3 }),
    listMemberCohorts: asyncMock([]),
  };
  const blogPostRepo = { findByMember: asyncMock([]) };
  const bannedWordRepo = { findAll: asyncMock([{ word: '봇' }, { word: 'test' }]) };
  const workspaceService = {
    getOrThrow: asyncMock({ id: 1, cohortRules }),
    touchProfileRefresh: asyncMock(undefined),
  };
  const submissionRepo = { deleteById: asyncMock({}) };
  const syncService = { syncMemberPRs: asyncMock({ synced: 2 }) };
  const octokit = {} as Octokit;

  const deps = {
    memberRepo,
    blogPostRepo,
    bannedWordRepo,
    workspaceService,
    octokit,
    submissionRepo,
    syncService,
  } as unknown as Deps;

  return { deps, memberRepo, blogPostRepo, workspaceService, submissionRepo, syncService, octokit };
}

describe('MemberService', () => {
  beforeEach(() => {
    mockFetchUserProfile.mockReset();
    mockRefreshMemberProfileById.mockReset();
  });

  describe('listMembers / getByGithubId / get', () => {
    it('should list members of the workspace with filters and map responses', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findWithFilters.mockResolvedValue([makeMember({}, [{ cohort: 8, role: 'crew' }])]);

      const result = await createMemberService(deps).listMembers({ cohort: 8 });

      expect(memberRepo.findWithFilters).toHaveBeenCalledWith(1, { cohort: 8 });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ githubId: 'crew1', cohort: 8, roles: ['crew'] });
    });

    it('should return null when a member does not exist', async () => {
      const service = createMemberService(makeDeps().deps);

      expect(await service.getByGithubId('nobody')).toBeNull();
      expect(await service.get(999)).toBeNull();
    });

    it('should return the mapped member when found', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findByGithubId.mockResolvedValue(makeMember());
      memberRepo.findByIdWithRelations.mockResolvedValue(makeMember({ manualNickname: '수동' }));
      const service = createMemberService(deps);

      expect(await service.getByGithubId('crew1')).toMatchObject({ githubId: 'crew1', roles: ['crew'] });
      expect(await service.get(10)).toMatchObject({ nickname: '수동' });
    });
  });

  describe('createMember', () => {
    it('should create a new member using the fetched GitHub profile', async () => {
      const { deps, memberRepo, octokit } = makeDeps();
      mockFetchUserProfile.mockResolvedValue({ githubId: 'Crew1', githubUserId: 1001, avatarUrl: 'https://a/1.png' });
      memberRepo.findByIdWithRelations.mockResolvedValue(makeMember({}, [{ cohort: 8, role: 'crew' }]));

      await createMemberService(deps).createMember({
        githubId: 'crew1',
        nickname: '크루',
        blog: 'https://blog.example.com',
        cohort: 8,
        track: 'backend',
      });

      expect(mockFetchUserProfile).toHaveBeenCalledWith(octokit, { username: 'crew1' });
      expect(memberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          githubId: 'Crew1',
          githubUserId: 1001,
          avatarUrl: 'https://a/1.png',
          nickname: '크루',
          manualNickname: '크루',
          blog: normalizeBlogUrl('https://blog.example.com'),
          rssStatus: 'unknown',
          track: 'backend',
          workspaceId: 1,
        }),
      );
      expect(memberRepo.create.mock.calls[0]![0]).toHaveProperty('profileFetchedAt', expect.any(Date));
      expect(memberRepo.upsertParticipation).toHaveBeenCalledWith(10, 8, 'crew');
    });

    it('should still create the member when the profile fetch fails', async () => {
      const { deps, memberRepo, octokit } = makeDeps();
      mockFetchUserProfile.mockRejectedValue(new Error('rate limited'));

      await createMemberService(deps).createMember({ githubId: 'crew2', githubUserId: 2002 });

      expect(mockFetchUserProfile).toHaveBeenCalledWith(octokit, { githubUserId: 2002, username: 'crew2' });
      expect(memberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ githubId: 'crew2', githubUserId: 2002, avatarUrl: null, profileFetchedAt: null }),
      );
      expect(memberRepo.create.mock.calls[0]![0]).not.toHaveProperty('blog');
      expect(memberRepo.upsertParticipation).not.toHaveBeenCalled();
    });

    it('should upsert one participation per given role', async () => {
      const { deps, memberRepo } = makeDeps();
      mockFetchUserProfile.mockRejectedValue(new Error('x'));

      await createMemberService(deps).createMember({ githubId: 'coach1', cohort: 7, roles: ['coach', 'reviewer'] });

      expect(memberRepo.upsertParticipation.mock.calls).toEqual([
        [10, 7, 'coach'],
        [10, 7, 'reviewer'],
      ]);
    });

    it('should update an existing member found by GitHub user id instead of creating', async () => {
      const { deps, memberRepo } = makeDeps();
      mockFetchUserProfile.mockResolvedValue({
        githubId: 'renamed',
        githubUserId: 1001,
        avatarUrl: 'https://a/new.png',
      });
      memberRepo.findByGithubUserId.mockResolvedValue(makeMember({ id: 77, blog: null }));

      await createMemberService(deps).createMember({
        githubId: 'crew1',
        nickname: '새닉',
        blog: 'https://b.example.com',
        track: 'frontend',
      });

      expect(memberRepo.findByGithubUserId).toHaveBeenCalledWith(1001, 1);
      expect(memberRepo.create).not.toHaveBeenCalled();
      expect(memberRepo.update).toHaveBeenCalledWith(
        77,
        expect.objectContaining({
          avatarUrl: 'https://a/new.png',
          manualNickname: '새닉',
          blog: normalizeBlogUrl('https://b.example.com'),
          track: 'frontend',
        }),
      );
    });

    it('should not overwrite the blog of an existing member', async () => {
      const { deps, memberRepo } = makeDeps();
      mockFetchUserProfile.mockRejectedValue(new Error('x'));
      memberRepo.findByGithubId.mockResolvedValue(makeMember({ id: 77, blog: 'https://old.example.com' }));

      await createMemberService(deps).createMember({ githubId: 'crew1', blog: 'https://new.example.com' });

      expect(memberRepo.update).toHaveBeenCalledWith(77, {});
    });
  });

  describe('updateMember', () => {
    it('should update only provided fields and normalize the blog', async () => {
      const { deps, memberRepo } = makeDeps();

      await createMemberService(deps).updateMember(10, {
        manualNickname: null,
        blog: 'https://x.example.com',
        cohortLocked: true,
      });

      expect(memberRepo.update).toHaveBeenCalledWith(10, {
        manualNickname: null,
        cohortLocked: true,
        blog: normalizeBlogUrl('https://x.example.com'),
        rssStatus: 'unknown',
        rssUrl: null,
        rssCheckedAt: null,
        rssError: null,
      });
      expect(memberRepo.deleteParticipationsByCohort).not.toHaveBeenCalled();
    });

    it('should replace roles of a cohort when both cohort and roles are given', async () => {
      const { deps, memberRepo } = makeDeps();

      await createMemberService(deps).updateMember(10, { cohort: 8, roles: ['crew', 'reviewer'], track: 'android' });

      expect(memberRepo.update).toHaveBeenCalledWith(10, { track: 'android' });
      expect(memberRepo.deleteParticipationsByCohort).toHaveBeenCalledWith(10, 8);
      expect(memberRepo.upsertParticipation.mock.calls).toEqual([
        [10, 8, 'crew'],
        [10, 8, 'reviewer'],
      ]);
    });

    it('should not touch participations when roles are missing', async () => {
      const { deps, memberRepo } = makeDeps();

      await createMemberService(deps).updateMember(10, { cohort: 8 });

      expect(memberRepo.deleteParticipationsByCohort).not.toHaveBeenCalled();
      expect(memberRepo.upsertParticipation).not.toHaveBeenCalled();
    });
  });

  describe('changeMemberCohort / deleteMemberCohort', () => {
    it('should move the roles of the old cohort to the new cohort', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findByIdWithRelations.mockResolvedValue(
        makeMember({}, [
          { cohort: 7, role: 'crew' },
          { cohort: 7, role: 'reviewer' },
        ]),
      );

      await createMemberService(deps).changeMemberCohort(10, 7, 8);

      expect(memberRepo.deleteParticipationsByCohort).toHaveBeenCalledWith(10, 7);
      expect(memberRepo.upsertParticipation.mock.calls).toEqual([
        [10, 8, 'crew'],
        [10, 8, 'reviewer'],
      ]);
    });

    it('should default to crew when the old cohort had no participation', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findByIdWithRelations.mockResolvedValue(makeMember());

      await createMemberService(deps).changeMemberCohort(10, 6, 8);

      expect(memberRepo.upsertParticipation).toHaveBeenCalledWith(10, 8, 'crew');
    });

    it('should throw when the member does not exist', async () => {
      await expect(createMemberService(makeDeps().deps).changeMemberCohort(1, 7, 8)).rejects.toThrow(
        'member not found',
      );
    });

    it('should delete participations of a cohort', async () => {
      const { deps, memberRepo } = makeDeps();

      expect(await createMemberService(deps).deleteMemberCohort(10, 7)).toBeNull();
      expect(memberRepo.deleteParticipationsByCohort).toHaveBeenCalledWith(10, 7);
    });
  });

  describe('blog posts and deletion', () => {
    it('should page blog posts with page size 10 and max 100', async () => {
      const { deps, blogPostRepo } = makeDeps();

      await createMemberService(deps).getMemberBlogPosts(10, 2);

      expect(blogPostRepo.findByMember).toHaveBeenCalledWith(10, 2, 10, 100);
    });

    it('should delete a member and all members of the workspace', async () => {
      const { deps, memberRepo } = makeDeps();
      const service = createMemberService(deps);

      await service.deleteMember(10);
      await service.deleteAllMembers();

      expect(memberRepo.deleteWithRelations).toHaveBeenCalledWith(10);
      expect(memberRepo.deleteAllWithRelations).toHaveBeenCalledWith(1);
    });

    it('should delete a submission only when it belongs to the member', async () => {
      const { deps, memberRepo, submissionRepo } = makeDeps();
      memberRepo.findByIdWithRelations.mockResolvedValue(makeMember({ submissions: [{ id: 5 }] }));
      const service = createMemberService(deps);

      await expect(service.deleteSubmission(10, 6)).rejects.toThrow('submission not found');
      expect(submissionRepo.deleteById).not.toHaveBeenCalled();

      await expect(service.deleteSubmission(10, 5)).resolves.toEqual({ success: true });
      expect(submissionRepo.deleteById).toHaveBeenCalledWith(5);
    });

    it('should throw when deleting a submission of an unknown member', async () => {
      await expect(createMemberService(makeDeps().deps).deleteSubmission(1, 5)).rejects.toThrow('member not found');
    });
  });

  describe('resyncMemberPRs / listMemberCohorts', () => {
    it('should resync PRs of the member by GitHub id', async () => {
      const { deps, memberRepo, syncService, octokit } = makeDeps();
      memberRepo.findByIdWithRelations.mockResolvedValue(makeMember({ githubId: 'crew9' }));

      await expect(createMemberService(deps).resyncMemberPRs(10)).resolves.toEqual({ synced: 2 });
      expect(syncService.syncMemberPRs).toHaveBeenCalledWith(octokit, 1, 'crew9');
    });

    it('should throw when resyncing an unknown member', async () => {
      await expect(createMemberService(makeDeps().deps).resyncMemberPRs(1)).rejects.toThrow('member not found');
    });

    it('should list member cohorts of the workspace', async () => {
      const { deps, memberRepo } = makeDeps();
      await createMemberService(deps).listMemberCohorts();
      expect(memberRepo.listMemberCohorts).toHaveBeenCalledWith(1);
    });
  });

  describe('refreshMemberProfile', () => {
    it('should refresh one member with banned words and cohort rules, forcing GitHub fetch', async () => {
      const { deps, memberRepo } = makeDeps();
      mockRefreshMemberProfileById.mockResolvedValue({ ok: true });

      await expect(createMemberService(deps).refreshMemberProfile(10)).resolves.toEqual({ ok: true });

      const [id, bannedWords, forceGithub, repo, , rules] = mockRefreshMemberProfileById.mock.calls[0]!;
      expect(id).toBe(10);
      expect(bannedWords).toEqual(new Set(['봇', 'test']));
      expect(forceGithub).toBe(true);
      expect(repo).toBe(memberRepo);
      expect(rules).toEqual(RULES_8_7);
    });

    it('should treat missing cohort rules as an empty list', async () => {
      const { deps } = makeDeps(null);
      await createMemberService(deps).refreshMemberProfile(10);
      expect(mockRefreshMemberProfileById.mock.calls[0]![5]).toEqual([]);
    });
  });

  describe('refreshWorkspaceProfiles', () => {
    const fresh = new Date();
    const stale = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const githubFlags = () => Object.fromEntries(mockRefreshMemberProfileById.mock.calls.map((c) => [c[0], c[2]]));

    it('should fetch GitHub only for stale members and aggregate results', async () => {
      const { deps, memberRepo, workspaceService } = makeDeps();
      memberRepo.findWithFilters.mockResolvedValue([
        makeMember({ id: 1, githubId: 'stale', profileFetchedAt: stale }),
        makeMember({ id: 2, githubId: 'fresh', profileFetchedAt: fresh }),
        makeMember({ id: 3, githubId: 'never', profileFetchedAt: null }),
      ]);
      mockRefreshMemberProfileById.mockImplementation(async (id) => {
        if (id === 3) throw new Error('github 404');
        return {};
      });

      const result = await createMemberService(deps).refreshWorkspaceProfiles({ cohort: 8 });

      expect(memberRepo.findWithFilters).toHaveBeenCalledWith(1, { cohort: 8 });
      expect(githubFlags()).toEqual({ 1: true, 2: false, 3: true });
      expect(result).toEqual({
        checked: 3,
        refreshed: 2,
        failed: 1,
        failures: [{ githubId: 'never', reason: 'github 404' }],
      });
      expect(workspaceService.touchProfileRefresh).toHaveBeenCalled();
    });

    it('should respect the limit and force options', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findWithFilters.mockResolvedValue([1, 2, 3].map((id) => makeMember({ id, profileFetchedAt: fresh })));
      mockRefreshMemberProfileById.mockResolvedValue({});

      await createMemberService(deps).refreshWorkspaceProfiles({ force: true, limit: 2, concurrency: 1 });

      expect(githubFlags()).toEqual({ 1: true, 2: true, 3: false });
      expect(memberRepo.findWithFilters).toHaveBeenCalledWith(1, {});
    });

    it('should use a custom stale threshold', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findWithFilters.mockResolvedValue([makeMember({ id: 1, profileFetchedAt: stale })]);
      mockRefreshMemberProfileById.mockResolvedValue({});

      await createMemberService(deps).refreshWorkspaceProfiles({ staleHours: 72 });

      expect(githubFlags()).toEqual({ 1: false });
    });

    it('should report at most 10 failures', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findWithFilters.mockResolvedValue(
        Array.from({ length: 12 }, (_, i) => makeMember({ id: i + 1, githubId: `m${i + 1}`, profileFetchedAt: fresh })),
      );
      mockRefreshMemberProfileById.mockRejectedValue('boom');

      const result = await createMemberService(deps).refreshWorkspaceProfiles();

      expect(result.failed).toBe(12);
      expect(result.failures).toHaveLength(10);
      expect(result.failures[0]).toEqual({ githubId: 'm1', reason: 'boom' });
    });
  });

  describe('recalculateMemberCohorts', () => {
    it('should throw when the member does not exist', async () => {
      await expect(createMemberService(makeDeps().deps).recalculateMemberCohorts(1)).rejects.toThrow(
        'member not found',
      );
    });

    it('should not change a cohort-locked member', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findByIdWithRelations.mockResolvedValue(
        makeMember({ cohortLocked: true, submissions: [1, 2, 3].map((i) => mergedSubmission(i, 2025)) }, [
          { cohort: 8, role: 'crew' },
        ]),
      );

      const result = await createMemberService(deps).recalculateMemberCohorts(10);

      expect(result).toMatchObject({ cohort: 8, cohortLocked: true });
      expect(memberRepo.deleteParticipationsByCohort).not.toHaveBeenCalled();
      expect(memberRepo.upsertParticipation).not.toHaveBeenCalled();
    });

    it('should not change cohorts with fewer than 3 merged submissions', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findByIdWithRelations.mockResolvedValue(
        makeMember(
          {
            submissions: [
              mergedSubmission(1, 2025),
              mergedSubmission(2, 2025),
              { ...mergedSubmission(3, 2025), status: 'closed' },
            ],
          },
          [{ cohort: 8, role: 'crew' }],
        ),
      );

      await createMemberService(deps).recalculateMemberCohorts(10);

      expect(memberRepo.deleteParticipationsByCohort).not.toHaveBeenCalled();
      expect(memberRepo.upsertParticipation).not.toHaveBeenCalled();
    });

    it('should not change cohorts when fewer than 3 submissions map to a cohort', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findByIdWithRelations.mockResolvedValue(
        makeMember({ submissions: [mergedSubmission(1, 2025), mergedSubmission(2, 2025), mergedSubmission(3, 2019)] }),
      );

      await createMemberService(deps).recalculateMemberCohorts(10);

      expect(memberRepo.upsertParticipation).not.toHaveBeenCalled();
    });

    it('should not change cohorts when no cohort reaches 50% dominance', async () => {
      const { deps, memberRepo } = makeDeps(JSON.stringify([...RULES_8_7, { year: 2024, cohort: 6 }]));
      memberRepo.findByIdWithRelations.mockResolvedValue(
        makeMember({ submissions: [2026, 2026, 2025, 2025, 2024, 2024].map((y, i) => mergedSubmission(i + 1, y)) }),
      );

      await createMemberService(deps).recalculateMemberCohorts(10);

      expect(memberRepo.upsertParticipation).not.toHaveBeenCalled();
      expect(memberRepo.deleteParticipationsByCohort).not.toHaveBeenCalled();
    });

    it('should move crew participation to the dominant cohort while keeping staff cohorts', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findByIdWithRelations.mockResolvedValue(
        makeMember({ submissions: [2025, 2025, 2025, 2026].map((y, i) => mergedSubmission(i + 1, y)) }, [
          { cohort: 8, role: 'crew' },
          { cohort: 6, role: 'coach' },
        ]),
      );

      await createMemberService(deps).recalculateMemberCohorts(10);

      // 8기 crew는 제출 이력에 있지만 지배 기수(7기)가 아니므로 제거, 6기 coach는 유지
      expect(memberRepo.deleteParticipationsByCohort.mock.calls).toEqual([[10, 8]]);
      expect(memberRepo.upsertParticipation).toHaveBeenCalledWith(10, 7, 'crew');
    });

    it('should remove crew cohorts without submissions and keep the dominant one', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findByIdWithRelations.mockResolvedValue(
        makeMember({ submissions: [2025, 2025, 2025].map((y, i) => mergedSubmission(i + 1, y)) }, [
          { cohort: 7, role: 'crew' },
          { cohort: 5, role: 'crew' },
        ]),
      );

      await createMemberService(deps).recalculateMemberCohorts(10);

      expect(memberRepo.deleteParticipationsByCohort).toHaveBeenCalledWith(10, 5);
      expect(memberRepo.deleteParticipationsByCohort).not.toHaveBeenCalledWith(10, 7);
      expect(memberRepo.upsertParticipation).not.toHaveBeenCalled();
    });
  });
});
