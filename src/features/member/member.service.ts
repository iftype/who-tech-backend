import type { Octokit } from '@octokit/rest';
import type { MemberRepository, MemberWithRelations } from '../../db/repositories/member.repository.js';
import type { BlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import type { BannedWordRepository } from '../../db/repositories/banned-word.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import { normalizeBlogUrl } from '../../shared/blog.js';
import { buildCohortList } from '../../shared/member-cohort.js';
import { mergePreviousGithubIds, shouldRefreshProfile } from '../../shared/github-profile.js';
import {
  resolveDisplayNickname,
  parseNicknameStats,
  extractNicknameTokens,
  mergeNicknameStat,
} from '../../shared/nickname.js';
import { fetchUserProfile } from '../sync/github.service.js';

export function createMemberService(deps: {
  memberRepo: MemberRepository;
  blogPostRepo: BlogPostRepository;
  bannedWordRepo: BannedWordRepository;
  workspaceService: WorkspaceService;
  octokit: Octokit;
}) {
  const { memberRepo, blogPostRepo, bannedWordRepo, workspaceService, octokit } = deps;

  const toResponse = (member: MemberWithRelations) => {
    const cohorts = buildCohortList(member.memberCohorts);

    const primaryCohort = cohorts[0];

    return {
      id: member.id,
      githubId: member.githubId,
      githubUserId: member.githubUserId,
      nickname: resolveDisplayNickname(member.manualNickname, member.nicknameStats, member.nickname),
      manualNickname: member.manualNickname,
      nicknameStats: parseNicknameStats(member.nicknameStats),
      avatarUrl: member.avatarUrl,
      blog: member.blog,
      lastPostedAt: member.lastPostedAt,
      profileFetchedAt: member.profileFetchedAt,
      profileRefreshError: member.profileRefreshError,
      rssStatus: member.rssStatus,
      rssUrl: member.rssUrl,
      rssCheckedAt: member.rssCheckedAt,
      rssError: member.rssError,
      cohorts,
      cohort: primaryCohort?.cohort ?? null,
      roles: primaryCohort?.roles ?? ['crew'],
      track: member.track ?? null,
      tracks: [
        ...new Set([
          ...(member.track ? [member.track] : []),
          ...member.submissions.map((s) => s.missionRepo.track).filter((t) => t !== null),
        ]),
      ],
      blogPosts: member.blogPosts,
      submissions: member.submissions,
      _count: member._count,
    };
  };

  async function refreshMemberProfileById(id: number, bannedWords: Set<string>, fetchGithub: boolean) {
    const member = await memberRepo.findByIdWithRelations(id);
    if (!member) {
      throw new Error('member not found');
    }

    // nicknameStats는 항상 재계산
    let statsValue: string | null = null;
    for (const submission of member.submissions) {
      for (const token of extractNicknameTokens(submission.title)) {
        if (!bannedWords.has(token)) {
          statsValue = JSON.stringify(mergeNicknameStat(statsValue, token, submission.submittedAt));
        }
      }
    }

    // refresh 시 fallback으로 기존 nickname을 쓰면 ban된 값이 그대로 남음 → null로 교체
    const resolvedNickname = resolveDisplayNickname(member.manualNickname, statsValue, null);

    if (!fetchGithub) {
      const updated = await memberRepo.update(id, { nicknameStats: statsValue, nickname: resolvedNickname });
      return toResponse(updated);
    }

    let profileRefreshError: string | null = null;
    let profileFields: {
      githubId: string;
      githubUserId: number | null;
      previousGithubIds: string | null;
      avatarUrl: string | null;
      blog?: string | null;
    };

    try {
      const profile = await fetchUserProfile(octokit, {
        githubUserId: member.githubUserId,
        username: member.githubId,
      });
      profileFields = {
        githubId: profile.githubId,
        githubUserId: profile.githubUserId,
        previousGithubIds: mergePreviousGithubIds(member.previousGithubIds, member.githubId, profile.githubId),
        avatarUrl: profile.avatarUrl ?? member.avatarUrl ?? null,
        ...(member.blog ? {} : { blog: profile.blog }),
      };
    } catch (error) {
      profileFields = {
        githubId: member.githubId,
        githubUserId: member.githubUserId ?? null,
        previousGithubIds: member.previousGithubIds ?? null,
        avatarUrl: member.avatarUrl ?? null,
      };
      profileRefreshError = error instanceof Error ? error.message : String(error);
    }

    const updated = await memberRepo.update(id, {
      ...profileFields,
      nicknameStats: statsValue,
      nickname: resolvedNickname,
      profileFetchedAt: new Date(),
      profileRefreshError,
    });

    return toResponse(updated);
  }

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
      return members.map(toResponse);
    },

    getByGithubId: async (githubId: string) => {
      const workspace = await workspaceService.getOrThrow();
      const member = await memberRepo.findByGithubId(githubId, workspace.id);
      return member ? toResponse(member) : null;
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

      // githubUserId로 실제 로그인 조회 (UI에서 #12345 형식으로 입력한 경우)
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

      // 이미 존재하는 멤버인지 확인 (githubUserId 또는 githubId 기준)
      const existing =
        (resolvedGithubUserId != null
          ? await memberRepo.findByGithubUserId(resolvedGithubUserId, workspace.id)
          : null) ?? (resolvedGithubId ? await memberRepo.findByGithubId(resolvedGithubId, workspace.id) : null);

      let memberId: number;
      if (existing) {
        // 이미 있으면 입력값으로 덮어쓸 필드만 업데이트
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
      return updated ? toResponse(updated) : null;
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
      return updated ? toResponse(updated) : null;
    },

    deleteMemberCohort: async (id: number, cohort: number) => {
      await memberRepo.deleteParticipationsByCohort(id, cohort);
      const updated = await memberRepo.findByIdWithRelations(id);
      return updated ? toResponse(updated) : null;
    },

    get: async (id: number) => {
      const member = await memberRepo.findByIdWithRelations(id);
      return member ? toResponse(member) : null;
    },

    getMemberBlogPosts: (id: number) => blogPostRepo.findByMember(id),

    refreshMemberProfile: async (id: number) => {
      const workspace = await workspaceService.getOrThrow();
      const bannedWordRows = await bannedWordRepo.findAll(workspace.id);
      const bannedWords = new Set(bannedWordRows.map((r) => r.word));
      return refreshMemberProfileById(id, bannedWords, true);
    },

    refreshWorkspaceProfiles: async (input?: { limit?: number; cohort?: number; staleHours?: number }) => {
      const workspace = await workspaceService.getOrThrow();
      const bannedWordRows = await bannedWordRepo.findAll(workspace.id);
      const bannedWords = new Set(bannedWordRows.map((r) => r.word));
      const staleHours = input?.staleHours ?? 24;

      const allMembers = await memberRepo.findWithFilters(workspace.id, {
        ...(input?.cohort !== undefined ? { cohort: input.cohort } : {}),
      });

      // GitHub API 호출 대상: stale 멤버만, limit 적용
      const staleLimit = input?.limit ?? 30;
      const githubTargetIds = new Set(
        allMembers
          .filter((m) => shouldRefreshProfile(m.profileFetchedAt, staleHours))
          .slice(0, staleLimit)
          .map((m) => m.id),
      );

      let checked = 0;
      let refreshed = 0;
      const failures: { githubId: string; reason: string }[] = [];

      // 닉네임 재계산은 전체 멤버 대상 (limit 없음)
      for (const member of allMembers) {
        checked += 1;
        try {
          await refreshMemberProfileById(member.id, bannedWords, githubTargetIds.has(member.id));
          refreshed += 1;
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          failures.push({ githubId: member.githubId, reason });
        }
      }

      return { checked, refreshed, failed: failures.length, failures: failures.slice(0, 10) };
    },

    deleteMember: (id: number) => memberRepo.deleteWithRelations(id),

    deleteAllMembers: async () => {
      const workspace = await workspaceService.getOrThrow();
      return memberRepo.deleteAllWithRelations(workspace.id);
    },
  };
}

export type MemberService = ReturnType<typeof createMemberService>;
