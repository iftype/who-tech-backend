import type { Octokit } from '@octokit/rest';
import type { MissionRepoRepository } from '../../db/repositories/mission-repo.repository.js';
import {
  createParticipationIdCache,
  type ParticipationIdCache,
  type SyncTarget,
  type SyncWriteRepository,
} from '../../db/repositories/sync-write.repository.js';
import type { BannedWordRepository } from '../../db/repositories/banned-word.repository.js';
import type { IgnoredDomainRepository } from '../../db/repositories/ignored-domain.repository.js';
import { mergePreviousGithubIds, shouldRefreshProfile } from '../../shared/github-profile.js';
import { HttpError } from '../../shared/http.js';
import { mergeNicknameStat, resolveDisplayNickname } from '../../shared/nickname.js';
import { fetchRepoPRs, fetchUserBlogCandidates } from '../../infra/github/github.client.js';
import { probeRss } from '../../infra/rss/rss.js';
import { parsePRsToSubmissions } from './sync.pr-parser.js';
import type { CohortRule } from '../../shared/types/index.js';

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

type ExistingMember = SyncTarget | null;

export function createRepoSyncer(deps: {
  syncWriteRepo: SyncWriteRepository;
  missionRepoRepo: MissionRepoRepository;
  bannedWordRepo: BannedWordRepository;
  ignoredDomainRepo: IgnoredDomainRepository;
}) {
  const { syncWriteRepo, missionRepoRepo, bannedWordRepo, ignoredDomainRepo } = deps;

  const fetchAndParse = async (
    octokit: Octokit,
    workspaceId: number,
    org: string,
    repo: { name: string; lastSyncAt?: Date | null },
    cohortRules: CohortRule[],
    signal?: AbortSignal,
  ) => {
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
        ...(since ? { since } : { sort: 'created', direction: 'asc' }),
        maxPages,
        ...(signal ? { signal } : {}),
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
    signal?: AbortSignal,
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
            signal,
          );
          let validBlog = null;
          for (const url of candidates) {
            const rssCheck = await probeRss(url);
            if (rssCheck.status === 'available') {
              validBlog = url;
              break;
            }
          }
          profileCache.set(cacheKey, { ...profile, blog: validBlog || (candidates[0] ?? null) });
          profileRefreshError = null;
        } catch (error) {
          profileRefreshError = error instanceof Error ? error.message : String(error);
          profileCache.set(cacheKey, { githubUserId, githubId: s.githubId, blog: null, avatarUrl: null });
        }
      }
      const profile = profileCache.get(cacheKey) ?? { githubUserId, githubId: s.githubId, blog: null, avatarUrl: null };
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
      if (profile.avatarUrl || profile.blog || profile.githubId !== s.githubId) profileRefreshError = null;
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
    ids: ParticipationIdCache,
  ): Promise<void> => {
    const { githubId, githubUserId, blog, avatarUrl, profileFetchedAt, profileRefreshError } = profile;
    const previousGithubIds = mergePreviousGithubIds(
      existingMember?.previousGithubIds ?? [],
      existingMember?.githubId,
      githubId,
    );

    if (!githubUserId) throw new Error(`githubUserId is missing for user: ${s.githubId}`);

    await syncWriteRepo.applyPullRequest(
      {
        workspaceId,
        githubUserId,
        member: {
          githubId,
          nickname: displayNickname,
          avatarUrl: avatarUrl ?? null,
          nicknameStats: statsValue,
          profileFetchedAt: profileFetchedAt ?? null,
          profileRefreshError: profileRefreshError ?? null,
          blog: blog ?? null,
        },
        previousGithubIds,
        cohort: s.cohort ? s.cohort : null,
        submission: {
          prNumber: s.prNumber,
          prUrl: s.prUrl,
          title: s.title,
          status: s.status,
          submittedAt: s.submittedAt,
          missionRepoId: repo.id,
        },
      },
      ids,
    );
  };

  const syncRepo = async (
    octokit: Octokit,
    workspaceId: number,
    org: string,
    repo: { id: number; name: string; track?: string | null; lastSyncAt?: Date | null },
    cohortRules: CohortRule[],
    onProgress?: (step: { total: number; processed: number; synced: number; percent: number; phase: string }) => void,
    signal?: AbortSignal,
    targetGithubId?: string,
  ): Promise<{ synced: number; failures: { prNumber: number; prUrl: string; error: string }[] }> => {
    const isCommonMission = repo.track === null || repo.track === undefined;
    const {
      submissions: allSubmissions,
      bannedWords,
      ignoredDomains,
    } = await fetchAndParse(octokit, workspaceId, org, repo, cohortRules, signal);

    const submissions = targetGithubId
      ? allSubmissions.filter((s) => s.githubId.toLowerCase() === targetGithubId.toLowerCase())
      : allSubmissions;

    const total = submissions.length;
    const profileCache = new Map<string, ProfileCacheEntry>();
    const participationIds = createParticipationIdCache();
    let synced = 0;
    let processed = 0;
    const failures: { prNumber: number; prUrl: string; error: string }[] = [];

    onProgress?.({ total, processed, synced, percent: total === 0 ? 100 : 0, phase: 'PR 파싱 완료' });

    for (const s of submissions) {
      if (signal?.aborted) throw new Error('cancelled');
      try {
        const existingMember = await syncWriteRepo.findTarget(s.githubUserId ?? null, s.githubId, workspaceId);

        // 공통 미션: 이미 알려진 멤버에만 submission 연결
        if (isCommonMission && !existingMember) continue;

        let statsValue = existingMember?.nicknameStats ?? null;
        for (const token of s.nicknameTokens) {
          if (!bannedWords.has(token)) {
            statsValue = JSON.stringify(mergeNicknameStat(statsValue, token, s.submittedAt));
          }
        }
        const displayNickname = resolveDisplayNickname(
          existingMember?.manualNickname,
          statsValue,
          existingMember?.nickname ?? null,
        );
        const profile = await resolveProfile(octokit, s, existingMember, profileCache, ignoredDomains, signal);
        await upsertMemberAndSubmission(
          workspaceId,
          s,
          profile,
          repo,
          statsValue,
          displayNickname,
          existingMember,
          participationIds,
        );
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

  return { syncRepo };
}
