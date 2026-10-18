import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Octokit } from '@octokit/rest';

// ESM 환경에서는 jest.unstable_mockModule + 동적 import 순서가 중요
const mockRefreshMemberProfileById = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.unstable_mockModule('../../features/member/member.profile-refresh.js', () => ({
  refreshMemberProfileById: mockRefreshMemberProfileById,
}));

const { createMemberPublicService } = await import('../../features/member/member.public.service.js');

type Deps = Parameters<typeof createMemberPublicService>[0];
type AsyncMock = ReturnType<typeof jest.fn<(...args: unknown[]) => Promise<unknown>>>;
const asyncMock = (value: unknown): AsyncMock =>
  jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(value);

// ─── 픽스처 ────────────────────────────────────────────────────────────────

const WORKSPACE = { id: 1, cohortRules: JSON.stringify([{ year: 2026, cohort: 8 }]) };

function stats(...entries: [string, number][]) {
  return JSON.stringify(entries.map(([nickname, count]) => ({ nickname, count, lastSeenAt: '2026-01-01' })));
}

function participations(...list: [number, string][]) {
  return list.map(([cohort, role]) => ({ cohort: { number: cohort }, role: { name: role } }));
}

function lightMember(overrides: Record<string, unknown> = {}) {
  return {
    githubId: 'crew1',
    nickname: null,
    manualNickname: null,
    nicknameStats: null,
    avatarUrl: 'https://a/1.png',
    track: null,
    blog: null,
    lastPostedAt: null,
    memberCohorts: participations([8, 'crew']),
    submissions: [] as unknown[],
    ...overrides,
  };
}

function submission(id: number, missionRepoId: number, repo: Record<string, unknown>, status = 'merged') {
  return {
    id,
    missionRepoId,
    prUrl: `https://github.com/woowacourse/${String(repo['name'])}/pull/${id}`,
    prNumber: id,
    title: `PR ${id}`,
    status,
    submittedAt: new Date(`2026-03-0${id}T00:00:00Z`),
    missionRepo: { track: 'backend', tabCategory: 'base', ...repo },
  };
}

function detailMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    githubId: 'crew1',
    nickname: 'fallback',
    manualNickname: null,
    nicknameStats: stats(['가람', 5]),
    avatarUrl: null,
    track: null,
    blog: 'https://blog.example.com',
    lastPostedAt: null,
    memberCohorts: participations([8, 'crew']),
    submissions: [] as unknown[],
    person: null,
    ...overrides,
  };
}

function makeDeps() {
  const memberRepo = {
    findNameSearchSource: asyncMock([]),
    findWithFiltersLight: asyncMock([]),
    findWithFiltersLightPage: asyncMock([]),
    countWithFilters: asyncMock(0),
    findByGithubId: asyncMock(null),
    listMemberCohorts: asyncMock([{ cohort: 8, count: 3 }]),
  };
  const blogPostRepo = {
    incrementViewCount: asyncMock({ url: 'https://post', viewCount: 4 }),
    findByMember: asyncMock([]),
    findFeed: asyncMock({ posts: [], nextCursor: null, totalCount: 0 }),
  };
  const tecoTalkRepo = { findByMemberId: asyncMock([]) };
  const cohortRepoRepo = { findByCohort: asyncMock([]) };
  const bannedWordRepo = { findAll: asyncMock([{ word: '봇' }]) };
  const workspaceService = { getOrThrow: asyncMock(WORKSPACE) };
  const activityLogService = {
    checkRateLimit: asyncMock({ allowed: true, remainingSeconds: 0, requestCount: 0 }),
    addLog: asyncMock(undefined),
  };
  const blogService = { syncMemberBlog: asyncMock(undefined) };
  const octokit = {} as Octokit;

  const deps = {
    memberRepo,
    blogPostRepo,
    tecoTalkRepo,
    cohortRepoRepo,
    bannedWordRepo,
    workspaceService,
    activityLogService,
    blogService,
    octokit,
  } as unknown as Deps;

  return { deps, memberRepo, blogPostRepo, tecoTalkRepo, cohortRepoRepo, activityLogService, blogService, octokit };
}

describe('MemberPublicService', () => {
  beforeEach(() => {
    mockRefreshMemberProfileById.mockReset();
  });

  describe('visitBlogPost / getCohorts', () => {
    it('should increment the view count of a blog post', async () => {
      const { deps, blogPostRepo } = makeDeps();
      await expect(createMemberPublicService(deps).visitBlogPost(3)).resolves.toEqual({
        url: 'https://post',
        viewCount: 4,
      });
      expect(blogPostRepo.incrementViewCount).toHaveBeenCalledWith(3);
    });

    it('should list cohorts of the workspace', async () => {
      const { deps, memberRepo } = makeDeps();
      await expect(createMemberPublicService(deps).getCohorts()).resolves.toEqual([{ cohort: 8, count: 3 }]);
      expect(memberRepo.listMemberCohorts).toHaveBeenCalledWith(1);
    });
  });

  describe('searchMembers', () => {
    it('should map members to the public shape', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findWithFiltersLight.mockResolvedValue([
        lightMember({
          nicknameStats: stats(['가람', 3]),
          memberCohorts: participations([8, 'crew'], [7, 'reviewer']),
          submissions: [
            { status: 'merged', missionRepo: { track: 'backend' } },
            { status: 'merged', missionRepo: { track: 'backend' } },
            { status: 'open', missionRepo: { track: 'android' } },
            { status: 'closed', missionRepo: { track: 'frontend' } },
          ],
        }),
      ]);

      const [member] = await createMemberPublicService(deps).searchMembers();

      expect(member).toEqual({
        githubId: 'crew1',
        nickname: '가람',
        avatarUrl: 'https://a/1.png',
        cohort: 8,
        roles: ['crew'],
        cohorts: [
          { cohort: 8, roles: ['crew'] },
          { cohort: 7, roles: ['reviewer'] },
        ],
        track: 'backend',
        tracks: ['backend', 'android'],
        blog: null,
        lastPostedAt: null,
      });
    });

    it('should fall back to the GitHub id when no nickname is known', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findWithFiltersLight.mockResolvedValue([lightMember({ memberCohorts: [] })]);

      const [member] = await createMemberPublicService(deps).searchMembers();

      expect(member).toMatchObject({ nickname: 'crew1', cohort: null, roles: ['crew'], track: null, tracks: [] });
    });

    it('should report the role of the filtered cohort and the explicit track first', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findWithFiltersLight.mockResolvedValue([
        lightMember({ track: 'frontend', memberCohorts: participations([8, 'crew'], [7, 'coach']) }),
      ]);

      const [member] = await createMemberPublicService(deps).searchMembers({ cohort: 7 });

      expect(member).toMatchObject({ cohort: 7, roles: ['coach'], track: 'frontend', tracks: ['frontend'] });
    });

    it('should add name matches from nickname stats ranked by score, at most 10', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findNameSearchSource.mockResolvedValue([
        { githubId: 'low', nicknameStats: stats(['김가람', 1]) },
        { githubId: 'none', nicknameStats: stats(['박', 9]) },
        { githubId: 'high', nicknameStats: stats(['김철수', 5]) },
        ...Array.from({ length: 10 }, (_, i) => ({ githubId: `k${i}`, nicknameStats: stats(['김', 2]) })),
      ]);

      await createMemberPublicService(deps).searchMembers({ q: ' 김 ' });

      const [, filters] = memberRepo.findWithFiltersLight.mock.calls[0]!;
      const ids = (filters as { nameMatchGithubIds: string[] }).nameMatchGithubIds;
      expect(ids).toHaveLength(10);
      expect(ids[0]).toBe('high');
      expect(ids).not.toContain('none');
      expect(ids).not.toContain('low');
      expect(filters).toMatchObject({ q: ' 김 ' });
    });

    it('should pass filters unchanged when there is no name match', async () => {
      const { deps, memberRepo } = makeDeps();
      const service = createMemberPublicService(deps);

      await service.searchMembers({ q: '   ', cohort: 8 });
      await service.searchMembers({ q: 'zzz' });

      expect(memberRepo.findNameSearchSource).toHaveBeenCalledTimes(1);
      expect(memberRepo.findWithFiltersLight.mock.calls[0]![1]).toEqual({ q: '   ', cohort: 8 });
      expect(memberRepo.findWithFiltersLight.mock.calls[1]![1]).toEqual({ q: 'zzz' });
    });
  });

  describe('searchMembersPage', () => {
    it('should return counts and the next offset while more members remain', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findWithFiltersLightPage.mockResolvedValue([lightMember(), lightMember({ githubId: 'crew2' })]);
      memberRepo.countWithFilters.mockImplementation(async (_id, filters) => {
        const group = (filters as { roleGroup?: string } | undefined)?.roleGroup;
        return group === 'crew' ? 4 : group === 'staff' ? 1 : 5;
      });

      const result = await createMemberPublicService(deps).searchMembersPage({ cohort: 8 }, { limit: 2, offset: 2 });

      expect(memberRepo.findWithFiltersLightPage).toHaveBeenCalledWith(1, { cohort: 8 }, { limit: 2, offset: 2 });
      expect(result.members.map((m) => m.githubId)).toEqual(['crew1', 'crew2']);
      expect(result).toMatchObject({ totalCount: 5, counts: { crew: 4, staff: 1 }, nextOffset: 4 });
    });

    it('should return a null next offset on the last page', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findWithFiltersLightPage.mockResolvedValue([lightMember()]);
      memberRepo.countWithFilters.mockResolvedValue(3);

      const result = await createMemberPublicService(deps).searchMembersPage(undefined, { limit: 2, offset: 2 });

      expect(result.nextOffset).toBeNull();
    });
  });

  describe('getMemberDetail', () => {
    it('should return null for an unknown member', async () => {
      const { deps } = makeDeps();
      await expect(createMemberPublicService(deps).getMemberDetail('nobody')).resolves.toBeNull();
    });

    it('should build the archive by cohort and level with precourse and unregistered repos', async () => {
      const { deps, memberRepo, cohortRepoRepo, tecoTalkRepo } = makeDeps();
      const racing = { name: 'java-racingcar', tabCategory: 'base' };
      const precourse = { name: 'java-precourse', tabCategory: 'common' };
      const lotto = { name: 'java-lotto', tabCategory: 'precourse' };
      const extra = { name: 'extra-mission', tabCategory: 'common', track: null };
      memberRepo.findByGithubId.mockResolvedValue(
        detailMember({
          memberCohorts: participations([8, 'crew'], [7, 'coach']),
          // repository는 제출을 최신순으로 돌려준다
          submissions: [
            submission(4, 500, { name: 'Lotto-precourse', tabCategory: 'base' }),
            submission(3, 400, extra),
            submission(2, 100, racing, 'closed'),
            submission(1, 100, racing),
          ],
          person: { id: 3, displayName: '가람', members: [{ githubId: 'crew1' }, { githubId: 'crew1-old' }] },
        }),
      );
      cohortRepoRepo.findByCohort.mockResolvedValue([
        { missionRepoId: 300, level: null, missionRepo: { ...lotto, track: 'backend' } },
        { missionRepoId: 100, level: 2, missionRepo: { ...racing, track: 'backend' } },
        { missionRepoId: 200, level: 1, missionRepo: { ...precourse, track: 'backend' } },
      ]);
      tecoTalkRepo.findByMemberId.mockResolvedValue([{ id: 1, title: '테코톡', viewCount: 99 }]);

      const detail = await createMemberPublicService(deps).getMemberDetail('crew1');

      // 코치로만 참여한 7기는 아카이브 대상이 아님
      expect(cohortRepoRepo.findByCohort).toHaveBeenCalledTimes(1);
      expect(cohortRepoRepo.findByCohort).toHaveBeenCalledWith(1, 8);
      expect(detail!.nickname).toBe('가람');
      expect(detail!.tecoTalks).toEqual([{ id: 1, title: '테코톡' }]);
      expect(detail!.person).toEqual({ id: 3, displayName: '가람', members: [{ githubId: 'crew1-old' }] });

      const [cohort8, unregistered] = detail!.archive;
      expect(cohort8!.cohort).toBe(8);
      expect(cohort8!.levels.map((l) => l.level)).toEqual([1, 2, null]);
      expect(cohort8!.levels[0]!.repos[0]).toMatchObject({
        name: 'java-precourse',
        tabCategory: 'precourse',
        submissions: null,
      });
      expect(cohort8!.levels[2]!.repos[0]).toMatchObject({ name: 'java-lotto', tabCategory: 'precourse' });
      // 제출은 오래된 순서
      expect(cohort8!.levels[1]!.repos[0]!.submissions!.map((s) => s.prNumber)).toEqual([1, 2]);

      expect(unregistered).toEqual({
        cohort: 0,
        levels: [
          {
            level: null,
            repos: [
              expect.objectContaining({ name: 'Lotto-precourse', tabCategory: 'precourse' }),
              expect.objectContaining({ name: 'extra-mission', tabCategory: 'common', track: null }),
            ],
          },
        ],
      });
    });

    it('should omit cohorts without registered repos and the unregistered group when empty', async () => {
      const { deps, memberRepo } = makeDeps();
      memberRepo.findByGithubId.mockResolvedValue(detailMember({ track: 'frontend' }));

      const detail = await createMemberPublicService(deps).getMemberDetail('crew1');

      expect(detail).toMatchObject({ archive: [], person: null, track: 'frontend', tracks: ['frontend'] });
    });
  });

  describe('getMemberBlogPosts', () => {
    it('should return null for an unknown member and the first 100 posts otherwise', async () => {
      const { deps, memberRepo, blogPostRepo } = makeDeps();
      const service = createMemberPublicService(deps);

      await expect(service.getMemberBlogPosts('nobody')).resolves.toBeNull();

      memberRepo.findByGithubId.mockResolvedValue(detailMember());
      await service.getMemberBlogPosts('crew1');
      expect(blogPostRepo.findByMember).toHaveBeenCalledWith(10, 1, 100);
    });
  });

  describe('getFeed', () => {
    function feedPost(id: number, member: Record<string, unknown>, authorName: string | null = null) {
      return {
        id,
        url: `https://post/${id}`,
        title: `글 ${id}`,
        publishedAt: new Date('2026-05-01'),
        authorName,
        member: {
          githubId: 'crew1',
          nickname: 'fallback',
          manualNickname: null,
          nicknameStats: null,
          avatarUrl: null,
          isTeamBlog: false,
          track: null,
          memberCohorts: participations([8, 'crew'], [7, 'reviewer']),
          submissions: [],
          ...member,
        },
      };
    }

    it('should pass only provided filters and map posts', async () => {
      const { deps, blogPostRepo } = makeDeps();
      blogPostRepo.findFeed.mockResolvedValue({
        posts: [
          feedPost(1, { manualNickname: '수동' }),
          feedPost(2, { isTeamBlog: true, githubId: 'team' }, '작성자'),
          feedPost(3, { isTeamBlog: true, githubId: 'team2', nickname: '팀' }),
        ],
        nextCursor: 'c2',
        totalCount: 30,
      });

      const result = await createMemberPublicService(deps).getFeed({ cohort: 7, cursor: 'c1', limit: 3 });

      expect(blogPostRepo.findFeed).toHaveBeenCalledWith(1, { cohort: 7, cursor: 'c1', limit: 3 });
      expect(result.nextCursor).toBe('c2');
      expect(result.totalCount).toBe(30);
      expect(result.posts.map((p) => p.member.nickname)).toEqual(['수동', '작성자', '팀']);
      expect(result.posts[0]!.member).toMatchObject({ cohort: 7, roles: ['reviewer'] });
    });

    it('should use the latest cohort without a cohort filter and accept all filters', async () => {
      const { deps, blogPostRepo } = makeDeps();
      blogPostRepo.findFeed.mockResolvedValue({
        posts: [feedPost(1, { track: 'android' })],
        nextCursor: null,
        totalCount: 1,
      });

      const result = await createMemberPublicService(deps).getFeed({ track: 'android', days: 7 });

      expect(blogPostRepo.findFeed).toHaveBeenCalledWith(1, { track: 'android', days: 7 });
      expect(result.posts[0]!.member).toMatchObject({
        cohort: 8,
        roles: ['crew'],
        track: 'android',
        tracks: ['android'],
      });
    });

    it('should call the feed without filters', async () => {
      const { deps, blogPostRepo } = makeDeps();
      await createMemberPublicService(deps).getFeed();
      expect(blogPostRepo.findFeed).toHaveBeenCalledWith(1, {});
    });
  });

  describe('refreshMemberProfile', () => {
    it('should throw for an unknown member', async () => {
      const { deps } = makeDeps();
      await expect(createMemberPublicService(deps).refreshMemberProfile('nobody')).rejects.toThrow('Member not found');
    });

    it('should stop and log when rate limited', async () => {
      const { deps, memberRepo, activityLogService } = makeDeps();
      memberRepo.findByGithubId.mockResolvedValue(detailMember());
      activityLogService.checkRateLimit.mockResolvedValue({ allowed: false, remainingSeconds: 42, requestCount: 3 });

      const result = await createMemberPublicService(deps).refreshMemberProfile('crew1');

      expect(result).toEqual({ rateLimited: true, remainingSeconds: 42 });
      expect(activityLogService.checkRateLimit).toHaveBeenCalledWith('crew1', 1);
      expect(activityLogService.addLog).toHaveBeenCalledWith('rate_limit_member', 'Rate limited: crew1', {
        source: 'client',
        memberGithubId: 'crew1',
        metadata: { remainingSeconds: 42, requestCount: 3 },
      });
      expect(mockRefreshMemberProfileById).not.toHaveBeenCalled();
    });

    it('should refresh the profile and blog, log, and return the updated detail', async () => {
      const { deps, memberRepo, activityLogService, blogService, octokit } = makeDeps();
      memberRepo.findByGithubId.mockResolvedValue(detailMember());
      mockRefreshMemberProfileById.mockResolvedValue({});

      const result = await createMemberPublicService(deps).refreshMemberProfile('crew1');

      expect(mockRefreshMemberProfileById).toHaveBeenCalledWith(10, new Set(['봇']), true, memberRepo, octokit, [
        { year: 2026, cohort: 8 },
      ]);
      expect(blogService.syncMemberBlog).toHaveBeenCalledWith(10, 1);
      expect(activityLogService.addLog).toHaveBeenCalledWith('refresh_member', 'Profile refreshed: crew1', {
        source: 'client',
        memberGithubId: 'crew1',
      });
      expect(result).toMatchObject({ rateLimited: false, member: { githubId: 'crew1' } });
    });

    it('should log and rethrow when the refresh fails', async () => {
      const { deps, memberRepo, activityLogService, blogService } = makeDeps();
      memberRepo.findByGithubId.mockResolvedValue(detailMember());
      mockRefreshMemberProfileById.mockRejectedValue(new Error('github down'));

      await expect(createMemberPublicService(deps).refreshMemberProfile('crew1')).rejects.toThrow('github down');

      expect(blogService.syncMemberBlog).not.toHaveBeenCalled();
      expect(activityLogService.addLog).toHaveBeenCalledWith(
        'refresh_error',
        'Profile refresh failed: crew1 - github down',
        { source: 'client', memberGithubId: 'crew1' },
      );
    });

    it('should stringify non-Error failures in the log', async () => {
      const { deps, memberRepo, activityLogService } = makeDeps();
      memberRepo.findByGithubId.mockResolvedValue(detailMember());
      mockRefreshMemberProfileById.mockRejectedValue('timeout');

      await expect(createMemberPublicService(deps).refreshMemberProfile('crew1')).rejects.toBe('timeout');
      expect(activityLogService.addLog.mock.calls[0]![1]).toBe('Profile refresh failed: crew1 - timeout');
    });
  });
});
