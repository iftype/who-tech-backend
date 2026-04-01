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
    // 닫힌 PR(병합되지 않은)은 건너뜀
    if (pr.state === 'closed' && !pr.merged_at) continue;

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
}) {
  const { memberRepo, missionRepoRepo, submissionRepo, workspaceRepo, bannedWordRepo, ignoredDomainRepo } = deps;

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
    const since = repo.lastSyncAt ?? undefined;

    // 금지어 및 무시 도메인 로드
    const [bannedWordRows, ignoredDomainRows] = await Promise.all([
      bannedWordRepo.findAll(workspaceId),
      ignoredDomainRepo.findAll(workspaceId),
    ]);
    const bannedWords = new Set(bannedWordRows.map((r) => r.word));
    const ignoredDomains = ignoredDomainRows.map((r) => r.domain);

    let prs: Awaited<ReturnType<typeof fetchRepoPRs>>;
    try {
      prs = await fetchRepoPRs(octokit, org, repo.name, ...(since ? [{ since }] : []));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new HttpError(500, `repo sync fetch failed: ${repo.name} — ${detail}`);
    }

    const submissions = parsePRsToSubmissions(prs, cohortRules);
    const total = submissions.length;
    const profileCache = new Map<
      string,
      { githubUserId: number | null; githubId: string; blog: string | null; avatarUrl: string | null }
    >();
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

        let blog = existingMember?.blog ?? null;
        let avatarUrl = existingMember?.avatarUrl ?? null;
        let githubId = s.githubId;
        let githubUserId = s.githubUserId ?? existingMember?.githubUserId ?? null;
        let profileFetchedAt = existingMember?.profileFetchedAt ?? null;
        let profileRefreshError: string | null = existingMember?.profileRefreshError ?? null;

        if (
          !existingMember?.blog ||
          !existingMember?.avatarUrl ||
          shouldRefreshProfile(existingMember?.profileFetchedAt)
        ) {
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
          blog = existingMember?.blog ?? (profile.githubId === 'ghost' ? null : profile.blog);
          avatarUrl =
            profile.githubId === 'ghost'
              ? (existingMember?.avatarUrl ?? null)
              : (profile.avatarUrl ?? existingMember?.avatarUrl ?? null);
          profileFetchedAt = new Date();
          if (profile.avatarUrl || profile.blog || profile.githubId !== s.githubId) {
            profileRefreshError = null;
          }
        }

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
      if (r.status !== 'active' || r.syncMode !== 'once' || r.lastSyncAt !== null) return false;
      if (cohort != null && !parseCohorts(r.cohorts).includes(cohort)) return false;
      return true;
    });

    let totalSynced = 0;
    for (let i = 0; i < activeRepos.length; i++) {
      const repo = activeRepos[i]!;
      const { synced } = await syncRepo(octokit, workspaceId, workspace.githubOrg, repo, cohortRules);
      totalSynced += synced;
      onProgress?.({ repo: repo.name, done: i + 1, total: activeRepos.length, synced });
    }

    await workspaceRepo.touch(workspaceId);
    return { totalSynced, reposSynced: activeRepos.length };
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
    for (let i = 0; i < continuousRepos.length; i++) {
      const repo = continuousRepos[i]!;
      const { synced } = await syncRepo(octokit, workspaceId, workspace.githubOrg, repo, cohortRules);
      totalSynced += synced;
      onProgress?.({ repo: repo.name, done: i + 1, total: continuousRepos.length, synced });
    }

    return { totalSynced, reposSynced: continuousRepos.length };
  };

  return { syncRepo, syncWorkspace, syncContinuousRepos };
}

export type SyncService = ReturnType<typeof createSyncService>;
