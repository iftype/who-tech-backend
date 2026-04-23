import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import type { BannedWordRepository } from '../../db/repositories/banned-word.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import PQueue from 'p-queue';
import { normalizeBlogUrl } from '../../shared/blog.js';
import { buildCohortList } from '../../shared/member-cohort.js';
import { shouldRefreshProfile } from '../../shared/github-profile.js';
import { fetchUserProfile, detectCohort } from '../sync/github.service.js';
import { toMemberResponse } from './member.response.js';
import { refreshMemberProfileById } from './member.profile-refresh.js';

export function createMemberService(deps: {
  memberRepo: MemberRepository;
  blogPostRepo: BlogPostRepository;
  bannedWordRepo: BannedWordRepository;
  workspaceService: WorkspaceService;
  octokit: Octokit;
}) {
  const { memberRepo, blogPostRepo, bannedWordRepo, workspaceService, octokit } = deps;

  return {
    listMembers: async (filters?: {
      q?: string;
      cohort?: number;
      hasBlog?: boolean;
      track?: string;
      role?: string;
    }) => {
      const workspace = await workspaceService.getOrThrow();
      const members = await memberRepo.findWithFilters(workspace.id, filters);
      return members.map(toMemberResponse);
    },

    getByGithubId: async (githubId: string) => {
      const workspace = await workspaceService.getOrThrow();
      const member = await memberRepo.findByGithubId(githubId, workspace.id);
      return member ? toMemberResponse(member) : null;
    },

    createMember: async (input: {
      githubId: string;
      githubUserId?: number | null;
      nickname?: string | null;
      cohort?: number | null;
      blog?: string | null;
      roles?: string[];
      track?: string | null;
    }) => {
      const workspace = await workspaceService.getOrThrow();

      let resolvedGithubId = input.githubId;
      let resolvedGithubUserId = input.githubUserId ?? null;
      let resolvedAvatarUrl: string | null = null;

      try {
        const profileInput: { githubUserId?: number | null; username?: string } = {};
        if (resolvedGithubUserId != null) profileInput.githubUserId = resolvedGithubUserId;
        if (resolvedGithubId) profileInput.username = resolvedGithubId;
        const profile = await fetchUserProfile(octokit, profileInput);
        resolvedGithubId = profile.githubId;
        resolvedGithubUserId = profile.githubUserId;
        resolvedAvatarUrl = profile.avatarUrl;
      } catch {
        // 프로필 fetch 실패해도 생성은 진행
      }

      const existing =
        (resolvedGithubUserId != null
          ? await memberRepo.findByGithubUserId(resolvedGithubUserId, workspace.id)
          : null) ?? (resolvedGithubId ? await memberRepo.findByGithubId(resolvedGithubId, workspace.id) : null);

      let memberId: number;
      if (existing) {
        await memberRepo.update(existing.id, {
          ...(resolvedAvatarUrl ? { avatarUrl: resolvedAvatarUrl, profileFetchedAt: new Date() } : {}),
          ...(input.nickname ? { manualNickname: input.nickname } : {}),
          ...(!existing.blog && input.blog
            ? {
                blog: normalizeBlogUrl(input.blog),
                rssStatus: 'unknown',
                rssUrl: null,
                rssCheckedAt: null,
                rssError: null,
              }
            : {}),
          ...(input.track ? { track: input.track } : {}),
        });
        memberId = existing.id;
      } else {
        const created = await memberRepo.create({
          githubId: resolvedGithubId,
          githubUserId: resolvedGithubUserId,
          previousGithubIds: null,
          avatarUrl: resolvedAvatarUrl,
          profileFetchedAt: resolvedAvatarUrl ? new Date() : null,
          ...(input.nickname ? { nickname: input.nickname, manualNickname: input.nickname } : {}),
          ...(input.blog
            ? {
                blog: normalizeBlogUrl(input.blog),
                rssStatus: 'unknown',
                rssUrl: null,
                rssCheckedAt: null,
                rssError: null,
              }
            : {}),
          ...(input.track ? { track: input.track } : {}),
          workspaceId: workspace.id,
        });
        memberId = created.id;
      }

      if (input.cohort != null) {
        const roles = input.roles?.length ? input.roles : ['crew'];
        for (const role of roles) {
          await memberRepo.upsertParticipation(memberId, input.cohort, role);
        }
      }

      const updated = await memberRepo.findByIdWithRelations(memberId);
      return updated ? toMemberResponse(updated) : null;
    },

    updateMember: async (
      id: number,
      input: {
        manualNickname?: string | null;
        blog?: string | null;
        roles?: string[];
        cohort?: number;
        track?: string | null;
      },
    ) => {
      await memberRepo.update(id, {
        ...(input.manualNickname !== undefined ? { manualNickname: input.manualNickname } : {}),
        ...(input.track !== undefined ? { track: input.track } : {}),
        ...(input.blog !== undefined
          ? {
              blog: normalizeBlogUrl(input.blog),
              rssStatus: 'unknown',
              rssUrl: null,
              rssCheckedAt: null,
              rssError: null,
            }
          : {}),
      });

      if (input.cohort != null && input.roles !== undefined) {
        await memberRepo.deleteParticipationsByCohort(id, input.cohort);
        for (const role of input.roles) {
          await memberRepo.upsertParticipation(id, input.cohort, role);
        }
      }

      const updated = await memberRepo.findByIdWithRelations(id);
      return updated ? toMemberResponse(updated) : null;
    },

    changeMemberCohort: async (id: number, oldCohort: number, newCohort: number) => {
      const member = await memberRepo.findByIdWithRelations(id);
      if (!member) throw new Error('member not found');
      const existing = buildCohortList(member.memberCohorts).find((c) => c.cohort === oldCohort);
      const roles = existing?.roles ?? ['crew'];
      await memberRepo.deleteParticipationsByCohort(id, oldCohort);
      for (const role of roles) {
        await memberRepo.upsertParticipation(id, newCohort, role);
      }
      const updated = await memberRepo.findByIdWithRelations(id);
      return updated ? toMemberResponse(updated) : null;
    },

    deleteMemberCohort: async (id: number, cohort: number) => {
      await memberRepo.deleteParticipationsByCohort(id, cohort);
      const updated = await memberRepo.findByIdWithRelations(id);
      return updated ? toMemberResponse(updated) : null;
    },

    get: async (id: number) => {
      const member = await memberRepo.findByIdWithRelations(id);
      return member ? toMemberResponse(member) : null;
    },

    getMemberBlogPosts: (id: number) => blogPostRepo.findByMember(id),

    refreshMemberProfile: async (id: number) => {
      const workspace = await workspaceService.getOrThrow();
      const bannedWordRows = await bannedWordRepo.findAll(workspace.id);
      const bannedWords = new Set(bannedWordRows.map((r) => r.word));
      return refreshMemberProfileById(id, bannedWords, true, memberRepo, octokit);
    },

    refreshWorkspaceProfiles: async (input?: {
      limit?: number;
      cohort?: number;
      staleHours?: number;
      force?: boolean;
      concurrency?: number;
    }) => {
      const workspace = await workspaceService.getOrThrow();
      const bannedWordRows = await bannedWordRepo.findAll(workspace.id);
      const bannedWords = new Set(bannedWordRows.map((r) => r.word));
      const staleHours = input?.staleHours ?? 24;

      const allMembers = await memberRepo.findWithFilters(workspace.id, {
        ...(input?.cohort !== undefined ? { cohort: input.cohort } : {}),
      });

      const staleLimit = input?.limit ?? 30;
      const githubTargetIds = new Set(
        allMembers
          .filter((m) => input?.force ?? shouldRefreshProfile(m.profileFetchedAt, staleHours))
          .slice(0, staleLimit)
          .map((m) => m.id),
      );

      type ProcessResult = { githubId: string; ok: true } | { githubId: string; ok: false; reason: string };

      const githubQueue = new PQueue({ concurrency: input?.concurrency ?? 5 });

      const processMember = async (
        member: Awaited<ReturnType<typeof memberRepo.findWithFilters>>[number],
      ): Promise<ProcessResult> => {
        try {
          await refreshMemberProfileById(member.id, bannedWords, githubTargetIds.has(member.id), memberRepo, octokit);
          return { githubId: member.githubId, ok: true };
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          return { githubId: member.githubId, ok: false, reason };
        }
      };

      const githubMembers = allMembers.filter((m) => githubTargetIds.has(m.id));
      const otherMembers = allMembers.filter((m) => !githubTargetIds.has(m.id));

      const githubTasks = githubMembers.map((member) => githubQueue.add(() => processMember(member)));

      const otherResults: ProcessResult[] = [];
      for (const member of otherMembers) {
        otherResults.push(await processMember(member));
      }

      const settledGithubResults = await Promise.allSettled(githubTasks);
      const githubResults: ProcessResult[] = settledGithubResults.map((r) =>
        r.status === 'fulfilled'
          ? r.value
          : { githubId: 'unknown', ok: false, reason: r.reason instanceof Error ? r.reason.message : String(r.reason) },
      );

      const allResults = [...githubResults, ...otherResults];
      const checked = allResults.length;
      const refreshed = allResults.filter((r) => r.ok).length;
      const failures = allResults
        .filter((r): r is Extract<ProcessResult, { ok: false }> => !r.ok)
        .map((r) => ({ githubId: r.githubId, reason: r.reason }));

      await workspaceService.touchProfileRefresh();

      return { checked, refreshed, failed: failures.length, failures: failures.slice(0, 10) };
    },

    deleteMember: (id: number) => memberRepo.deleteWithRelations(id),

    deleteAllMembers: async () => {
      const workspace = await workspaceService.getOrThrow();
      return memberRepo.deleteAllWithRelations(workspace.id);
    },

    recalculateMemberCohorts: async (id: number) => {
      const member = await memberRepo.findByIdWithRelations(id);
      if (!member) throw new Error('member not found');

      const workspace = await workspaceService.getOrThrow();
      const cohortRules = JSON.parse(workspace.cohortRules) as { year: number; cohort: number }[];

      const cohortSet = new Set<number>();
      for (const sub of member.submissions) {
        const cohort = detectCohort(new Date(sub.submittedAt), cohortRules);
        if (cohort != null) cohortSet.add(cohort);
      }

      const currentCohorts = buildCohortList(member.memberCohorts);

      for (const current of currentCohorts) {
        if (!cohortSet.has(current.cohort)) {
          await memberRepo.deleteParticipationsByCohort(id, current.cohort);
        }
      }

      for (const cohort of cohortSet) {
        if (!currentCohorts.some((c) => c.cohort === cohort)) {
          await memberRepo.upsertParticipation(id, cohort, 'crew');
        }
      }

      const updated = await memberRepo.findByIdWithRelations(id);
      return updated ? toMemberResponse(updated) : null;
    },

    listMemberCohorts: async () => {
      const workspace = await workspaceService.getOrThrow();
      return memberRepo.listMemberCohorts(workspace.id);
    },
  };
}

export type MemberService = ReturnType<typeof createMemberService>;
