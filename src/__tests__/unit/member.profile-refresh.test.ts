import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Octokit } from '@octokit/rest';

// ESM 환경에서는 jest.unstable_mockModule + 동적 import 순서가 중요
const mockFetchUserBlogCandidates = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockProbeRss = jest.fn<(url: string) => Promise<{ status: string }>>();

jest.unstable_mockModule('../../infra/github/github.client.js', () => ({
  fetchUserBlogCandidates: mockFetchUserBlogCandidates,
  detectCohort: (date: Date, rules: { year: number; cohort: number }[]) =>
    rules.find((r) => r.year === date.getFullYear())?.cohort ?? null,
}));

jest.unstable_mockModule('../../infra/rss/rss.js', () => ({
  probeRss: mockProbeRss,
}));

const { refreshMemberProfileById } = await import('../../features/member/member.profile-refresh.js');

type MemberRepo = Parameters<typeof refreshMemberProfileById>[3];

const RULES = [
  { year: 2026, cohort: 8 },
  { year: 2025, cohort: 7 },
];
const octokit = {} as Octokit;

function participations(...list: [number, string][]) {
  return list.map(([cohort, role]) => ({ cohort: { number: cohort }, role: { name: role } }));
}

function sub(title: string, year = 2026, track: string | null = 'backend', status = 'merged') {
  return { title, status, submittedAt: new Date(`${year}-04-01T00:00:00Z`), missionRepo: { track } };
}

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    githubId: 'crew1',
    githubUserId: 1001,
    previousGithubIds: null as string | null,
    nickname: null,
    manualNickname: null as string | null,
    nicknameStats: null,
    avatarUrl: 'https://a/old.png',
    blog: 'https://old.example.com',
    track: 'backend',
    cohortLocked: false,
    lastPostedAt: null,
    profileFetchedAt: null,
    profileRefreshError: null,
    rssStatus: 'unknown',
    rssUrl: null,
    rssCheckedAt: null,
    rssError: null,
    memberCohorts: participations([8, 'crew']),
    submissions: [sub('가람')],
    blogPosts: [],
    _count: { submissions: 1, blogPosts: 0 },
    ...overrides,
  };
}

// update는 받은 필드를 합친 최신 상태를 돌려주는 실제 repository처럼 동작시킨다
function makeRepo(member: ReturnType<typeof makeMember> | null) {
  let state = member ? { ...member } : null;
  const repo = {
    findByIdWithRelations: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(member),
    update: jest.fn<(id: number, data: Record<string, unknown>) => Promise<unknown>>(async (_id, data) => {
      state = { ...state!, ...data };
      return state;
    }),
    syncPreviousGithubIds: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(undefined),
    deleteParticipationsByCohort: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(undefined),
    upsertParticipation: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(undefined),
  };
  return { repo, memberRepo: repo as unknown as MemberRepo };
}

const NO_BANNED = new Set<string>();

describe('refreshMemberProfileById', () => {
  beforeEach(() => {
    mockFetchUserBlogCandidates.mockReset();
    mockProbeRss.mockReset();
  });

  it('should throw when the member does not exist', async () => {
    const { memberRepo } = makeRepo(null);
    await expect(refreshMemberProfileById(1, NO_BANNED, false, memberRepo, octokit)).rejects.toThrow(
      'member not found',
    );
  });

  describe('nickname', () => {
    it('should rebuild nickname stats from PR titles without banned words', async () => {
      const { repo, memberRepo } = makeRepo(makeMember({ submissions: [sub('가람 봇'), sub('가람'), sub('봇')] }));

      const result = await refreshMemberProfileById(10, new Set(['봇']), false, memberRepo, octokit);

      const data = repo.update.mock.calls[0]![1];
      expect(Object.keys(data)).toEqual(['nicknameStats', 'nickname']);
      const stats = JSON.parse(data['nicknameStats'] as string) as { nickname: string; count: number }[];
      expect(stats.map((s) => s.nickname)).toEqual(['가람']);
      expect(stats[0]!.count).toBe(2);
      expect(data['nickname']).toBe('가람');
      expect(result.nickname).toBe('가람');
      expect(mockFetchUserBlogCandidates).not.toHaveBeenCalled();
      expect(repo.syncPreviousGithubIds).not.toHaveBeenCalled();
    });

    it('should keep the manual nickname as the display nickname', async () => {
      const { repo, memberRepo } = makeRepo(makeMember({ manualNickname: '수동닉' }));

      await refreshMemberProfileById(10, NO_BANNED, false, memberRepo, octokit);

      expect(repo.update.mock.calls[0]![1]['nickname']).toBe('수동닉');
    });

    it('should store null stats when no title has a Korean token', async () => {
      const { repo, memberRepo } = makeRepo(makeMember({ submissions: [sub('step1 submit')] }));

      await refreshMemberProfileById(10, NO_BANNED, false, memberRepo, octokit);

      expect(repo.update.mock.calls[0]![1]).toEqual({ nicknameStats: null, nickname: null });
    });
  });

  describe('GitHub profile', () => {
    it('should use the first candidate with an available RSS feed and track renames', async () => {
      const { repo, memberRepo } = makeRepo(makeMember({ previousGithubIds: JSON.stringify(['ancient']) }));
      mockFetchUserBlogCandidates.mockResolvedValue({
        profile: { githubId: 'crew1-new', githubUserId: 1001, avatarUrl: 'https://a/new.png' },
        candidates: ['https://no-rss.example.com', 'https://rss.example.com', 'https://third.example.com'],
      });
      mockProbeRss.mockImplementation(async (url) => ({
        status: url === 'https://rss.example.com' ? 'available' : 'unavailable',
      }));

      await refreshMemberProfileById(10, NO_BANNED, true, memberRepo, octokit);

      expect(mockFetchUserBlogCandidates).toHaveBeenCalledWith(octokit, { githubUserId: 1001, username: 'crew1' });
      expect(mockProbeRss.mock.calls.map((c) => c[0])).toEqual([
        'https://no-rss.example.com',
        'https://rss.example.com',
      ]);
      const data = repo.update.mock.calls[0]![1];
      expect(data).toMatchObject({
        githubId: 'crew1-new',
        githubUserId: 1001,
        previousGithubIds: JSON.stringify(['ancient', 'crew1']),
        avatarUrl: 'https://a/new.png',
        blog: 'https://rss.example.com',
        profileRefreshError: null,
      });
      expect(data['profileFetchedAt']).toEqual(expect.any(Date));
      // 이전 ID 테이블은 memberRepo.update가 맞춘다 (따로 동기화하지 않음, member.repository.int.test)
      expect(repo.syncPreviousGithubIds).not.toHaveBeenCalled();
    });

    it('should fall back to the first candidate when no RSS is available', async () => {
      const { repo, memberRepo } = makeRepo(makeMember());
      mockFetchUserBlogCandidates.mockResolvedValue({
        profile: { githubId: 'crew1', githubUserId: 1001, avatarUrl: null },
        candidates: ['https://first.example.com', 'https://second.example.com'],
      });
      mockProbeRss.mockResolvedValue({ status: 'unavailable' });

      await refreshMemberProfileById(10, NO_BANNED, true, memberRepo, octokit);

      expect(repo.update.mock.calls[0]![1]).toMatchObject({
        blog: 'https://first.example.com',
        avatarUrl: 'https://a/old.png',
        previousGithubIds: null,
      });
    });

    it('should keep the existing blog when there is no candidate', async () => {
      const { repo, memberRepo } = makeRepo(makeMember({ avatarUrl: null }));
      mockFetchUserBlogCandidates.mockResolvedValue({
        profile: { githubId: 'crew1', githubUserId: 1001, avatarUrl: null },
        candidates: [],
      });

      await refreshMemberProfileById(10, NO_BANNED, true, memberRepo, octokit);

      expect(repo.update.mock.calls[0]![1]).toMatchObject({ blog: 'https://old.example.com', avatarUrl: null });
    });

    it('should keep existing profile fields and record the error when GitHub fails', async () => {
      const { repo, memberRepo } = makeRepo(makeMember({ previousGithubIds: '["old"]' }));
      mockFetchUserBlogCandidates.mockRejectedValue(new Error('Not Found'));

      await refreshMemberProfileById(10, NO_BANNED, true, memberRepo, octokit);

      const data = repo.update.mock.calls[0]![1];
      expect(data).toMatchObject({
        githubId: 'crew1',
        githubUserId: 1001,
        previousGithubIds: '["old"]',
        avatarUrl: 'https://a/old.png',
        profileRefreshError: 'Not Found',
      });
      expect(data).not.toHaveProperty('blog');
      expect(repo.syncPreviousGithubIds).not.toHaveBeenCalled();
    });

    it('should stringify non-Error failures', async () => {
      const { repo, memberRepo } = makeRepo(makeMember({ githubUserId: null, avatarUrl: null }));
      mockFetchUserBlogCandidates.mockRejectedValue('rate limited');

      await refreshMemberProfileById(10, NO_BANNED, true, memberRepo, octokit);

      expect(repo.update.mock.calls[0]![1]).toMatchObject({
        githubUserId: null,
        avatarUrl: null,
        profileRefreshError: 'rate limited',
      });
    });
  });

  describe('track', () => {
    it('should update the track when the dominant track changed', async () => {
      const { repo, memberRepo } = makeRepo(
        makeMember({ track: 'backend', submissions: [sub('가람', 2026, 'frontend'), sub('가람', 2026, 'frontend')] }),
      );

      const result = await refreshMemberProfileById(10, NO_BANNED, false, memberRepo, octokit);

      expect(repo.update.mock.calls[1]).toEqual([10, { track: 'frontend' }]);
      expect(result.track).toBe('frontend');
    });

    it('should not update the track when it did not change', async () => {
      const { repo, memberRepo } = makeRepo(makeMember());

      await refreshMemberProfileById(10, NO_BANNED, false, memberRepo, octokit);

      expect(repo.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('cohort', () => {
    const years = (...ys: number[]) => ys.map((y) => sub('가람', y));

    it('should skip cohort detection without rules or for locked members', async () => {
      const noRules = makeRepo(makeMember({ submissions: years(2025, 2025, 2025) }));
      await refreshMemberProfileById(10, NO_BANNED, false, noRules.memberRepo, octokit);

      const locked = makeRepo(makeMember({ cohortLocked: true, submissions: years(2025, 2025, 2025) }));
      await refreshMemberProfileById(10, NO_BANNED, false, locked.memberRepo, octokit, RULES);

      for (const { repo } of [noRules, locked]) {
        expect(repo.upsertParticipation).not.toHaveBeenCalled();
        expect(repo.deleteParticipationsByCohort).not.toHaveBeenCalled();
      }
    });

    it('should require at least 3 merged submissions mapped to a cohort', async () => {
      const fewMerged = makeRepo(
        makeMember({ submissions: [...years(2025, 2025), sub('가람', 2025, 'backend', 'open')] }),
      );
      await refreshMemberProfileById(10, NO_BANNED, false, fewMerged.memberRepo, octokit, RULES);

      const unmapped = makeRepo(makeMember({ submissions: years(2025, 2025, 2019) }));
      await refreshMemberProfileById(10, NO_BANNED, false, unmapped.memberRepo, octokit, RULES);

      for (const { repo } of [fewMerged, unmapped]) {
        expect(repo.upsertParticipation).not.toHaveBeenCalled();
        expect(repo.deleteParticipationsByCohort).not.toHaveBeenCalled();
      }
    });

    it('should not change cohorts below 50% dominance', async () => {
      const rules = [...RULES, { year: 2024, cohort: 6 }];
      const { repo, memberRepo } = makeRepo(makeMember({ submissions: years(2026, 2026, 2025, 2025, 2024, 2024) }));

      await refreshMemberProfileById(10, NO_BANNED, false, memberRepo, octokit, rules);

      expect(repo.upsertParticipation).not.toHaveBeenCalled();
      expect(repo.deleteParticipationsByCohort).not.toHaveBeenCalled();
    });

    it('should move crew participation to the dominant cohort and keep staff cohorts', async () => {
      const { repo, memberRepo } = makeRepo(
        makeMember({
          submissions: years(2025, 2025, 2025, 2026),
          memberCohorts: participations([8, 'crew'], [6, 'reviewer'], [5, 'crew']),
        }),
      );

      await refreshMemberProfileById(10, NO_BANNED, false, memberRepo, octokit, RULES);

      // 5기: 제출 이력 없음 → 제거, 8기: 지배 기수(7기)가 아님 → 제거, 6기 리뷰어 → 유지
      const deleted = repo.deleteParticipationsByCohort.mock.calls.map((c) => c[1]);
      expect(new Set(deleted)).toEqual(new Set([5, 8]));
      expect(deleted).not.toContain(6);
      expect(repo.upsertParticipation).toHaveBeenCalledWith(10, 7, 'crew');
    });

    it('should not re-add the dominant cohort when already participating', async () => {
      const { repo, memberRepo } = makeRepo(makeMember({ submissions: years(2026, 2026, 2026) }));

      await refreshMemberProfileById(10, NO_BANNED, false, memberRepo, octokit, RULES);

      expect(repo.upsertParticipation).not.toHaveBeenCalled();
      expect(repo.deleteParticipationsByCohort).not.toHaveBeenCalled();
    });
  });
});
