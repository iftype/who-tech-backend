import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import type { TecoTalkRepository } from '../../db/repositories/tecotalk.repository.js';
import type { CohortRepoRepository } from '../../db/repositories/cohort-repo.repository.js';
import type { BannedWordRepository } from '../../db/repositories/banned-word.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { ActivityLogService } from '../activity-log/activity-log.service.js';
import type { BlogService } from '../blog/blog.service.js';
import type { Octokit } from '@octokit/rest';
import { resolveDisplayNickname, scoreTopNicknameMatch } from '../../shared/nickname.js';
import { buildCohortList } from '../../shared/member-cohort.js';
import { computeDominantTrack } from '../../shared/member-track.js';
import { refreshMemberProfileById } from './member.profile-refresh.js';

export function createMemberPublicService(deps: {
  memberRepo: MemberRepository;
  blogPostRepo: BlogPostRepository;
  tecoTalkRepo: TecoTalkRepository;
  cohortRepoRepo: CohortRepoRepository;
  bannedWordRepo: BannedWordRepository;
  workspaceService: WorkspaceService;
  activityLogService: ActivityLogService;
  blogService: BlogService;
  octokit: Octokit;
}) {
  const {
    memberRepo,
    blogPostRepo,
    tecoTalkRepo,
    cohortRepoRepo,
    bannedWordRepo,
    workspaceService,
    activityLogService,
    blogService,
    octokit,
  } = deps;

  interface ArchiveRepo {
    name: string;
    track: string | null;
    tabCategory: string;
    submissions: Array<{ prUrl: string; prNumber: number; title: string; status: string; submittedAt: Date }> | null;
  }

  type SearchFilters = {
    q?: string;
    cohort?: number;
    track?: string;
    role?: string;
    roleGroup?: 'crew' | 'staff';
  };

  type PublicMember = {
    githubId: string;
    nickname: string;
    avatarUrl: string | null;
    cohort: number | null;
    roles: string[];
    cohorts: { cohort: number; roles: string[] }[];
    track: string | null;
    tracks: string[];
    blog: string | null;
    lastPostedAt: Date | null;
  };

  function toPublicMember(
    m: Awaited<ReturnType<MemberRepository['findWithFiltersLight']>>[number],
    filters?: SearchFilters,
  ) {
    const cohorts = buildCohortList(m.memberCohorts);

    const targetCohort = filters?.cohort ? cohorts.find((c) => c.cohort === filters.cohort) : cohorts[0];

    const inferredTrack = computeDominantTrack(m.submissions);
    return {
      githubId: m.githubId,
      nickname: resolveDisplayNickname(m.manualNickname, m.nicknameStats, m.nickname) ?? m.githubId,
      avatarUrl: m.avatarUrl,
      cohort: targetCohort?.cohort ?? null,
      roles: targetCohort?.roles ?? ['crew'],
      cohorts,
      track: m.track ?? inferredTrack ?? null,
      tracks: [
        ...new Set([
          ...(m.track ? [m.track] : []),
          ...(inferredTrack ? [inferredTrack] : []),
          ...m.submissions
            .filter((s) => s.status !== 'closed')
            .map((s) => s.missionRepo.track)
            .filter((t): t is string => t !== null),
        ]),
      ],
      blog: m.blog,
      lastPostedAt: m.lastPostedAt,
    } satisfies PublicMember;
  }

  // q가 nicknameStats 상위 토큰과 매칭되는 멤버의 githubId 목록.
  // 점수순 상위 NAME_MATCH_LIMIT명만 반환해 "김" 같은 짧은 검색어에도 결과가 쏟아지지 않게 한다.
  const NAME_MATCH_LIMIT = 10;
  async function computeNameMatchGithubIds(workspaceId: number, filters?: SearchFilters): Promise<string[]> {
    const q = filters?.q?.trim();
    if (!q) return [];
    const source = await memberRepo.findNameSearchSource(workspaceId);
    return source
      .map((m) => ({ githubId: m.githubId, score: scoreTopNicknameMatch(m.nicknameStats, q) }))
      .filter((m) => m.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, NAME_MATCH_LIMIT)
      .map((m) => m.githubId);
  }

  const service = {
    // 블로그 글 클릭(조회) 기록: viewCount +1 후 대상 URL 반환 (who-tech 내부 조회수)
    visitBlogPost: async (postId: number): Promise<{ url: string; viewCount: number } | null> => {
      return blogPostRepo.incrementViewCount(postId);
    },

    searchMembers: async (filters?: SearchFilters) => {
      const workspace = await workspaceService.getOrThrow();
      const nameMatchGithubIds = await computeNameMatchGithubIds(workspace.id, filters);
      const effectiveFilters = nameMatchGithubIds.length > 0 ? { ...filters, nameMatchGithubIds } : filters;
      const members = await memberRepo.findWithFiltersLight(workspace.id, effectiveFilters);
      return members.map((m) => toPublicMember(m, filters));
    },

    searchMembersPage: async (
      filters: SearchFilters | undefined,
      pagination: { limit: number; offset: number },
    ): Promise<{
      members: PublicMember[];
      totalCount: number;
      counts: { crew: number; staff: number };
      nextOffset: number | null;
    }> => {
      const workspace = await workspaceService.getOrThrow();
      const nameMatchGithubIds = await computeNameMatchGithubIds(workspace.id, filters);
      const effectiveFilters = nameMatchGithubIds.length > 0 ? { ...filters, nameMatchGithubIds } : filters;
      const [members, totalCount, crewCount, staffCount] = await Promise.all([
        memberRepo.findWithFiltersLightPage(workspace.id, effectiveFilters, pagination),
        memberRepo.countWithFilters(workspace.id, effectiveFilters),
        memberRepo.countWithFilters(workspace.id, { ...effectiveFilters, roleGroup: 'crew' }),
        memberRepo.countWithFilters(workspace.id, { ...effectiveFilters, roleGroup: 'staff' }),
      ]);
      const nextOffset = pagination.offset + members.length < totalCount ? pagination.offset + members.length : null;

      return {
        members: members.map((m) => toPublicMember(m, filters)),
        totalCount,
        counts: { crew: crewCount, staff: staffCount },
        nextOffset,
      };
    },

    getMemberDetail: async (githubId: string) => {
      const workspace = await workspaceService.getOrThrow();
      const member = await memberRepo.findByGithubId(githubId, workspace.id);
      if (!member) return null;

      const nickname = resolveDisplayNickname(member.manualNickname, member.nicknameStats, member.nickname);
      const cohorts = buildCohortList(member.memberCohorts);
      const tecoTalks = (await tecoTalkRepo.findByMemberId(member.id)).map(
        ({ viewCount: _viewCount, ...talk }) => talk,
      );

      const submissionsByRepo = new Map<
        number,
        Array<{ prUrl: string; prNumber: number; title: string; status: string; submittedAt: Date }>
      >();
      for (const s of [...member.submissions].reverse()) {
        if (!submissionsByRepo.has(s.missionRepoId)) submissionsByRepo.set(s.missionRepoId, []);
        submissionsByRepo.get(s.missionRepoId)!.push({
          prUrl: s.prUrl,
          prNumber: s.prNumber,
          title: s.title,
          status: s.status,
          submittedAt: s.submittedAt,
        });
      }

      const archive: {
        cohort: number;
        levels: {
          level: number | null;
          repos: ArchiveRepo[];
        }[];
      }[] = [];

      const processedRepoIds = new Set<number>();

      const crewOnlyCohorts = cohorts.filter(
        (c) => c.roles.includes('crew') && !c.roles.some((r) => r === 'coach' || r === 'reviewer'),
      );

      for (const { cohort } of crewOnlyCohorts) {
        const cohortRepos = await cohortRepoRepo.findByCohort(workspace.id, cohort);
        if (cohortRepos.length === 0) continue;

        const levelMap = new Map<number | null, ArchiveRepo[]>();
        for (const cr of cohortRepos) {
          processedRepoIds.add(cr.missionRepoId);
          const level = cr.level;
          if (!levelMap.has(level)) levelMap.set(level, []);
          // Precourse check first (highest priority)
          let tabCategory: string;
          if (cr.missionRepo.name.toLowerCase().includes('precourse')) {
            tabCategory = 'precourse';
          } else if (cr.missionRepo.tabCategory === 'precourse') {
            tabCategory = 'precourse';
          } else {
            tabCategory = cr.missionRepo.tabCategory;
          }
          levelMap.get(level)!.push({
            name: cr.missionRepo.name,
            track: cr.missionRepo.track,
            tabCategory,
            submissions: submissionsByRepo.get(cr.missionRepoId) ?? null,
          });
        }

        const sortedLevels = [...levelMap.keys()].sort((a, b) => {
          if (a === null) return 1;
          if (b === null) return -1;
          return a - b;
        });

        const cohortArchive = {
          cohort,
          levels: sortedLevels.map((level) => ({
            level,
            repos: levelMap.get(level)!,
          })),
        };
        archive.push(cohortArchive);
      }

      // Collect any submissions that belong to repos not explicitly assigned to the member's cohorts
      const unregisteredReposMap = new Map<number, ArchiveRepo>();
      for (const s of member.submissions) {
        if (!processedRepoIds.has(s.missionRepoId)) {
          if (!unregisteredReposMap.has(s.missionRepoId)) {
            let tabCategory: string;
            if (s.missionRepo.name.toLowerCase().includes('precourse')) {
              tabCategory = 'precourse';
            } else if (s.missionRepo.tabCategory === 'precourse') {
              tabCategory = 'precourse';
            } else {
              tabCategory = s.missionRepo.tabCategory;
            }
            unregisteredReposMap.set(s.missionRepoId, {
              name: s.missionRepo.name,
              track: s.missionRepo.track,
              tabCategory,
              submissions: submissionsByRepo.get(s.missionRepoId) ?? null,
            });
          }
        }
      }

      if (unregisteredReposMap.size > 0) {
        archive.push({
          cohort: 0,
          levels: [
            {
              level: null,
              repos: Array.from(unregisteredReposMap.values()),
            },
          ],
        });
      }

      const inferredTrack = computeDominantTrack(member.submissions);
      return {
        githubId: member.githubId,
        nickname,
        avatarUrl: member.avatarUrl,
        cohorts,
        track: member.track ?? inferredTrack ?? null,
        tracks: [
          ...new Set([
            ...(member.track ? [member.track] : []),
            ...(inferredTrack ? [inferredTrack] : []),
            ...member.submissions
              .filter((s) => s.status !== 'closed')
              .map((s) => s.missionRepo.track)
              .filter((t) => t !== null),
          ]),
        ],
        blog: member.blog,
        lastPostedAt: member.lastPostedAt,
        archive,
        tecoTalks,
        person: member.person
          ? {
              id: member.person.id,
              displayName: member.person.displayName,
              members: member.person.members.filter((m) => m.githubId !== member.githubId),
            }
          : null,
      };
    },

    getMemberBlogPosts: async (githubId: string) => {
      const workspace = await workspaceService.getOrThrow();
      const member = await memberRepo.findByGithubId(githubId, workspace.id);
      if (!member) return null;
      return blogPostRepo.findByMember(member.id, 1, 100);
    },

    getCohorts: async () => {
      const workspace = await workspaceService.getOrThrow();
      return memberRepo.listMemberCohorts(workspace.id);
    },

    getFeed: async (filters?: { cohort?: number; track?: string; days?: number; limit?: number; cursor?: string }) => {
      const workspace = await workspaceService.getOrThrow();

      const feed = await blogPostRepo.findFeed(workspace.id, {
        ...(filters?.cohort != null ? { cohort: filters.cohort } : {}),
        ...(filters?.track ? { track: filters.track } : {}),
        ...(filters?.cursor ? { cursor: filters.cursor } : {}),
        ...(filters?.days != null ? { days: filters.days } : {}),
        ...(filters?.limit != null ? { limit: filters.limit } : {}),
      });

      const posts = feed.posts.map((p) => {
        const cohorts = buildCohortList(p.member.memberCohorts);

        const targetCohort = filters?.cohort ? cohorts.find((c) => c.cohort === filters.cohort) : cohorts[0];

        const inferredTrack = computeDominantTrack(p.member.submissions);
        return {
          id: p.id,
          url: p.url,
          title: p.title,
          publishedAt: p.publishedAt,
          member: {
            githubId: p.member.githubId,
            nickname: resolveDisplayNickname(p.member.manualNickname, p.member.nicknameStats, p.member.nickname),
            avatarUrl: p.member.avatarUrl,
            cohort: targetCohort?.cohort ?? null,
            roles: targetCohort?.roles ?? ['crew'],
            cohorts,
            track: p.member.track ?? inferredTrack ?? null,
            tracks: [
              ...new Set([
                ...(p.member.track ? [p.member.track] : []),
                ...(inferredTrack ? [inferredTrack] : []),
                ...p.member.submissions
                  .filter((s) => s.status !== 'closed')
                  .map((s) => s.missionRepo.track)
                  .filter((t) => t !== null),
              ]),
            ],
          },
        };
      });

      return { posts, nextCursor: feed.nextCursor, totalCount: feed.totalCount };
    },

    refreshMemberProfile: async (githubId: string) => {
      const workspace = await workspaceService.getOrThrow();
      const member = await memberRepo.findByGithubId(githubId, workspace.id);
      if (!member) throw new Error('Member not found');

      const rateLimit = await activityLogService.checkRateLimit(githubId, 1);
      if (!rateLimit.allowed) {
        await activityLogService.addLog('rate_limit_member', `Rate limited: ${githubId}`, {
          source: 'client',
          memberGithubId: githubId,
          metadata: { remainingSeconds: rateLimit.remainingSeconds, requestCount: rateLimit.requestCount },
        });
        return { rateLimited: true, remainingSeconds: rateLimit.remainingSeconds };
      }

      const bannedWordRows = await bannedWordRepo.findAll(workspace.id);
      const bannedWords = new Set(bannedWordRows.map((r) => r.word));
      const cohortRules = JSON.parse(workspace.cohortRules) as { year: number; cohort: number }[];

      try {
        await refreshMemberProfileById(member.id, bannedWords, true, memberRepo, octokit, cohortRules);
        await blogService.syncMemberBlog(member.id, workspace.id);
        await activityLogService.addLog('refresh_member', `Profile refreshed: ${githubId}`, {
          source: 'client',
          memberGithubId: githubId,
        });
        const refreshedMember = await service.getMemberDetail(githubId);
        return { rateLimited: false, member: refreshedMember };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await activityLogService.addLog('refresh_error', `Profile refresh failed: ${githubId} - ${message}`, {
          source: 'client',
          memberGithubId: githubId,
        });
        throw error;
      }
    },
  };

  return service;
}

export type MemberPublicService = ReturnType<typeof createMemberPublicService>;
