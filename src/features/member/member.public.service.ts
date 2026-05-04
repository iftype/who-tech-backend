import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import type { CohortRepoRepository } from '../../db/repositories/cohort-repo.repository.js';
import type { BannedWordRepository } from '../../db/repositories/banned-word.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { ActivityLogService } from '../activity-log/activity-log.service.js';
import type { BlogService } from '../blog/blog.service.js';
import type { Octokit } from '@octokit/rest';
import { resolveDisplayNickname } from '../../shared/nickname.js';
import { buildCohortList } from '../../shared/member-cohort.js';
import { computeDominantTrack } from '../../shared/member-track.js';
import { refreshMemberProfileById } from './member.profile-refresh.js';

export function createMemberPublicService(deps: {
  memberRepo: MemberRepository;
  blogPostRepo: BlogPostRepository;
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

  const service = {
    searchMembers: async (filters?: {
      q?: string;
      cohort?: number;
      track?: string;
      role?: string;
      roleGroup?: 'crew' | 'staff';
    }) => {
      const workspace = await workspaceService.getOrThrow();
      const members = await memberRepo.findWithFiltersLight(workspace.id, filters);
      return members.map((m) => {
        const cohorts = buildCohortList(m.memberCohorts);

        const targetCohort = filters?.cohort ? cohorts.find((c) => c.cohort === filters.cohort) : cohorts[0];

        const inferredTrack = computeDominantTrack(m.submissions);
        return {
          githubId: m.githubId,
          nickname: resolveDisplayNickname(m.manualNickname, m.nicknameStats, m.nickname),
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
                .filter((t) => t !== null),
            ]),
          ],
          blog: m.blog,
          lastPostedAt: m.lastPostedAt,
        };
      });
    },

    getMemberDetail: async (githubId: string) => {
      const workspace = await workspaceService.getOrThrow();
      const member = await memberRepo.findByGithubId(githubId, workspace.id);
      if (!member) return null;

      const nickname = resolveDisplayNickname(member.manualNickname, member.nicknameStats, member.nickname);
      const cohorts = buildCohortList(member.memberCohorts);

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
