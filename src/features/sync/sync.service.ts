import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { MissionRepoRepository } from '../../db/repositories/mission-repo.repository.js';
import type { SubmissionRepository } from '../../db/repositories/submission.repository.js';
import type { WorkspaceRepository } from '../../db/repositories/workspace.repository.js';
import type { BannedWordRepository } from '../../db/repositories/banned-word.repository.js';
import type { IgnoredDomainRepository } from '../../db/repositories/ignored-domain.repository.js';
import { parseCohorts } from '../../shared/cohort-regex.js';
import { mergePreviousGithubIds, shouldRefreshProfile } from '../../shared/github-profile.js';
import { HttpError } from '../../shared/http.js';
import { extractNicknameTokens, mergeNicknameStat, resolveDisplayNickname } from '../../shared/nickname.js';
import { fetchRepoPRs, fetchUserBlogCandidates, detectCohort } from './github.service.js';
import { probeRss } from '../blog/blog.service.js';
import type { CohortRule, ParsedSubmission, PrStatus } from '../../shared/types/index.js';
import type { ActivityLogService } from '../activity-log/activity-log.service.js';

type RawPR = {
  number: number;
  html_url: string;
  title: string;
  state: string;
  merged_at: string | null;
  user: { login: string; id?: number } | null;
  base: { ref: string };
  created_at: string;
};

function resolvePrStatus(state: string, merged_at: string | null): PrStatus {
  if (state === 'open') return 'open';
  return merged_at ? 'merged' : 'closed';
}

export function parsePRsToSubmissions(prs: RawPR[], cohortRules: CohortRule[]): ParsedSubmission[] {
  const results: ParsedSubmission[] = [];

  for (const pr of prs) {
    if (!pr.user) continue;
    // GitHub 탈퇴 계정은 login이 "ghost"로 변경되므로 건너뜀
    if (pr.user.login === 'ghost') continue;

    const submittedAt = new Date(pr.created_at);
    const cohort = detectCohort(submittedAt, cohortRules);
    const nicknameTokens = extractNicknameTokens(pr.title);

    results.push({
      githubUserId: pr.user.id ?? null,
      githubId: pr.user.login,
      nicknameTokens,
      prNumber: pr.number,
      prUrl: pr.html_url,
      title: pr.title,
      submittedAt,
      cohort,
      status: resolvePrStatus(pr.state, pr.merged_at),
    });
  }

  return results;
}

export function createSyncService(deps: {
  memberRepo: MemberRepository;
  missionRepoRepo: MissionRepoRepository;
  submissionRepo: SubmissionRepository;
  workspaceRepo: WorkspaceRepository;
  bannedWordRepo: BannedWordRepository;
  ignoredDomainRepo: IgnoredDomainRepository;
  activityLogService: ActivityLogService;
}) {
  const {
    memberRepo,
    missionRepoRepo,
    submissionRepo,
    workspaceRepo,
    bannedWordRepo,
    ignoredDomainRepo,
    activityLogService,
  } = deps;

  type ProfileCacheEntry = {
    githubUserId: number | null;
    githubId: string;
    blog: string | null;
    avatarUrl: string | null;
  };

  type ResolvedProfile = {
    githubId: string;
    githubUserId: number | null;
    blog: string | null;
    avatarUrl: string | null;
    profileFetchedAt: Date | null;
    profileRefreshError: string | null;
  };

  type ExistingMember = {
    blog?: string | null;
    avatarUrl?: string | null;
    profileFetchedAt?: Date | null;
    profileRefreshError?: string | null;
    githubUserId?: number | null;
    githubId?: string;
    previousGithubIds?: string | null;
    manualNickname?: string | null;
    nickname?: string | null;
    nicknameStats?: string | null;
  } | null;

  const fetchAndParse = async (
    octokit: Octokit,
    workspaceId: number,
    org: string,
    repo: { name: string; lastSyncAt?: Date | null },
    cohortRules: CohortRule[],
  ): Promise<{
    submissions: ReturnType<typeof parsePRsToSubmissions>;
    bannedWords: Set<string>;
    ignoredDomains: string[];
  }> => {
    const since = repo.lastSyncAt ? new Date(repo.lastSyncAt.getTime() - 5 * 60 * 1000) : undefined;
    const maxPages = since ? 1 : 30;

    const [bannedWordRows, ignoredDomainRows] = await Promise.all([
      bannedWordRepo.findAll(workspaceId),
      ignoredDomainRepo.findAll(workspaceId),
    ]);
    const bannedWords = new Set(bannedWordRows.map((r) => r.word));
    const ignoredDomains = ignoredDomainRows.map((r) => r.domain);

    let prs: Awaited<ReturnType<typeof fetchRepoPRs>>;
    try {
      prs = await fetchRepoPRs(octokit, org, repo.name, {
        ...(since ? { since } : {}),
        maxPages,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new HttpError(500, `repo sync fetch failed: ${repo.name} — ${detail}`);
    }

    const submissions = parsePRsToSubmissions(prs, cohortRules);
    return { submissions, bannedWords, ignoredDomains };
  };

  const resolveProfile = async (
    octokit: Octokit,
    s: ReturnType<typeof parsePRsToSubmissions>[number],
    existingMember: ExistingMember,
    profileCache: Map<string, ProfileCacheEntry>,
    ignoredDomains: string[],
  ): Promise<ResolvedProfile> => {
    let blog = existingMember?.blog ?? null;
    let avatarUrl = existingMember?.avatarUrl ?? null;
    let githubId = s.githubId;
    let githubUserId = s.githubUserId ?? existingMember?.githubUserId ?? null;
    let profileFetchedAt = existingMember?.profileFetchedAt ?? null;
    let profileRefreshError: string | null = existingMember?.profileRefreshError ?? null;

    if (!existingMember?.blog || !existingMember?.avatarUrl || shouldRefreshProfile(existingMember?.profileFetchedAt)) {
      const cacheKey = githubUserId != null ? `id:${githubUserId}` : `login:${s.githubId}`;
      if (!profileCache.has(cacheKey)) {
        try {
          const { profile, candidates } = await fetchUserBlogCandidates(
            octokit,
            { githubUserId, username: s.githubId },
            ignoredDomains,
          );
          let validBlog = null;
          for (const url of candidates) {
            const rssCheck = await probeRss(url);
            if (rssCheck.status === 'available') {
              validBlog = url;
              break;
            }
          }
          profileCache.set(cacheKey, {
            ...profile,
            blog: validBlog || (candidates[0] ?? null),
          });
          profileRefreshError = null;
        } catch (error) {
          profileRefreshError = error instanceof Error ? error.message : String(error);
          profileCache.set(cacheKey, {
            githubUserId,
            githubId: s.githubId,
            blog: null,
            avatarUrl: null,
          });
        }
      }
      const profile = profileCache.get(cacheKey) ?? {
        githubUserId,
        githubId: s.githubId,
        blog: null,
        avatarUrl: null,
      };
      // 탈퇴 계정은 login이 "ghost"로 반환됨 — 기존 githubId 유지
      githubId = profile.githubId === 'ghost' ? s.githubId : profile.githubId;
      githubUserId = profile.githubUserId ?? githubUserId;
      blog =
        profile.githubId === 'ghost' ? (existingMember?.blog ?? null) : (profile.blog ?? existingMember?.blog ?? null);
      avatarUrl =
        profile.githubId === 'ghost'
          ? (existingMember?.avatarUrl ?? null)
          : (profile.avatarUrl ?? existingMember?.avatarUrl ?? null);
      profileFetchedAt = new Date();
      if (profile.avatarUrl || profile.blog || profile.githubId !== s.githubId) {
        profileRefreshError = null;
      }
    }

    return { githubId, githubUserId, blog, avatarUrl, profileFetchedAt, profileRefreshError };
  };

  const upsertMemberAndSubmission = async (
    workspaceId: number,
    s: ReturnType<typeof parsePRsToSubmissions>[number],
    profile: ResolvedProfile,
    repo: { id: number },
    statsValue: string | null,
    displayNickname: string | null,
    existingMember: ExistingMember,
  ): Promise<void> => {
    const { githubId, githubUserId, blog, avatarUrl, profileFetchedAt, profileRefreshError } = profile;

    const previousGithubIds = mergePreviousGithubIds(
      existingMember?.previousGithubIds,
      existingMember?.githubId,
      githubId,
    );

    if (!githubUserId) {
      throw new Error(`githubUserId is missing for user: ${s.githubId}`);
    }

    const member = await memberRepo.upsert(workspaceId, githubUserId, {
      githubId,
      githubUserId,
      previousGithubIds: previousGithubIds ?? null,
      nickname: displayNickname,
      avatarUrl: avatarUrl ?? null,
      nicknameStats: statsValue,
      profileFetchedAt: profileFetchedAt ?? null,
      profileRefreshError: profileRefreshError ?? null,
      blog: blog ?? null,
      workspaceId,
    });

    if (s.cohort) {
      await memberRepo.upsertParticipation(member.id, s.cohort, 'crew');
    }

    await submissionRepo.upsert({
      where: {
        prNumber_missionRepoId: { prNumber: s.prNumber, missionRepoId: repo.id },
      },
      create: {
        prNumber: s.prNumber,
        prUrl: s.prUrl,
        title: s.title,
        status: s.status,
        submittedAt: s.submittedAt,
        memberId: member.id,
        missionRepoId: repo.id,
      },
      update: {
        memberId: member.id,
        title: s.title,
        prUrl: s.prUrl,
        status: s.status,
      },
    });
  };

  const syncRepo = async (
    octokit: Octokit,
    workspaceId: number,
    org: string,
    repo: {
      id: number;
      name: string;
      track?: string | null;
      lastSyncAt?: Date | null;
    },
    cohortRules: CohortRule[],
    onProgress?: (step: { total: number; processed: number; synced: number; percent: number; phase: string }) => void,
  ): Promise<{ synced: number; failures: { prNumber: number; prUrl: string; error: string }[] }> => {
    const isCommonMission = repo.track === null || repo.track === undefined;

    const { submissions, bannedWords, ignoredDomains } = await fetchAndParse(
      octokit,
      workspaceId,
      org,
      repo,
      cohortRules,
    );

    const total = submissions.length;
    const profileCache = new Map<string, ProfileCacheEntry>();
    let synced = 0;
    let processed = 0;
    const failures: { prNumber: number; prUrl: string; error: string }[] = [];

    onProgress?.({ total, processed, synced, percent: total === 0 ? 100 : 0, phase: 'PR 파싱 완료' });

    for (const s of submissions) {
      try {
        const existingMember =
          (s.githubUserId != null ? await memberRepo.findByGithubUserId(s.githubUserId, workspaceId) : null) ??
          (await memberRepo.findByGithubId(s.githubId, workspaceId));

        // 공통 미션: 이미 알려진 멤버에만 submission 연결
        if (isCommonMission && !existingMember) continue;

        // 금지어 필터 후 닉네임 통계 업데이트
        let statsValue = existingMember?.nicknameStats ?? null;
        for (const token of s.nicknameTokens) {
          if (!bannedWords.has(token)) {
            const updated = mergeNicknameStat(statsValue, token, s.submittedAt);
            statsValue = JSON.stringify(updated);
          }
        }
        const displayNickname = resolveDisplayNickname(
          existingMember?.manualNickname,
          statsValue,
          existingMember?.nickname ?? null,
        );

        const profile = await resolveProfile(octokit, s, existingMember, profileCache, ignoredDomains);

        await upsertMemberAndSubmission(workspaceId, s, profile, repo, statsValue, displayNickname, existingMember);

        synced++;
      } catch (err) {
        failures.push({
          prNumber: s.prNumber,
          prUrl: s.prUrl,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        processed++;
        onProgress?.({
          total,
          processed,
          synced,
          percent: total === 0 ? 100 : Math.round((processed / total) * 100),
          phase: 'PR 처리 중',
        });
      }
    }

    await missionRepoRepo.touch(repo.id);
    onProgress?.({ total, processed, synced, percent: 100, phase: '완료' });
    return { synced, failures };
  };

  const syncWorkspace = async (
    octokit: Octokit,
    workspaceId: number,
    onProgress?: (step: { repo: string; done: number; total: number; synced: number }) => void,
    cohort?: number,
  ): Promise<{ totalSynced: number; reposSynced: number }> => {
    const workspace = await workspaceRepo.findByIdOrThrow(workspaceId);
    const cohortRules: CohortRule[] = JSON.parse(workspace.cohortRules);

    const repos = await missionRepoRepo.findMany({ workspaceId });
    const activeRepos = repos.filter((r) => {
      if (r.status !== 'active') return false;
      if (cohort != null && !parseCohorts(r.cohorts).includes(cohort)) return false;
      return true;
    });

    let totalSynced = 0;
    let reposSynced = 0;

    for (let i = 0; i < activeRepos.length; i++) {
      const repo = activeRepos[i]!;
      try {
        const { synced } = await syncRepo(octokit, workspaceId, workspace.githubOrg, repo, cohortRules);
        totalSynced += synced;
        reposSynced++;
        onProgress?.({ repo: repo.name, done: i + 1, total: activeRepos.length, synced });

        if (synced > 0) {
          await activityLogService.addLog('sync', `Workspace Sync: [${repo.name}] synced ${synced} items`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await activityLogService.addLog('sync_error', `Workspace Sync Failed: [${repo.name}] - ${message}`);
        onProgress?.({ repo: `${repo.name} (failed)`, done: i + 1, total: activeRepos.length, synced: 0 });
      }
    }

    await workspaceRepo.touch(workspaceId);
    return { totalSynced, reposSynced };
  };

  const syncContinuousRepos = async (
    octokit: Octokit,
    workspaceId: number,
    onProgress?: (step: { repo: string; done: number; total: number; synced: number }) => void,
  ): Promise<{ totalSynced: number; reposSynced: number }> => {
    const workspace = await workspaceRepo.findByIdOrThrow(workspaceId);
    const cohortRules: CohortRule[] = JSON.parse(workspace.cohortRules);

    const repos = await missionRepoRepo.findMany({ workspaceId });
    const continuousRepos = repos.filter((r) => r.status === 'active' && r.syncMode === 'continuous');

    let totalSynced = 0;
    let reposSynced = 0;

    for (let i = 0; i < continuousRepos.length; i++) {
      const repo = continuousRepos[i]!;
      try {
        const { synced } = await syncRepo(octokit, workspaceId, workspace.githubOrg, repo, cohortRules);
        totalSynced += synced;
        reposSynced++;
        onProgress?.({ repo: repo.name, done: i + 1, total: continuousRepos.length, synced });

        if (synced > 0) {
          await activityLogService.addLog('sync', `Continuous Sync: [${repo.name}] synced ${synced} items`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await activityLogService.addLog('sync_error', `Continuous Sync Failed: [${repo.name}] - ${message}`);
        onProgress?.({ repo: `${repo.name} (failed)`, done: i + 1, total: continuousRepos.length, synced: 0 });
      }
    }

    return { totalSynced, reposSynced };
  };

  return { syncRepo, syncWorkspace, syncContinuousRepos };
}

export type SyncService = ReturnType<typeof createSyncService>;
