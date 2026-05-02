import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { MissionRepoRepository } from '../../db/repositories/mission-repo.repository.js';
import type { SubmissionRepository } from '../../db/repositories/submission.repository.js';
import type { WorkspaceRepository } from '../../db/repositories/workspace.repository.js';
import type { BannedWordRepository } from '../../db/repositories/banned-word.repository.js';
import type { IgnoredDomainRepository } from '../../db/repositories/ignored-domain.repository.js';
import type { CohortRepoRepository } from '../../db/repositories/cohort-repo.repository.js';
import { parseCohorts } from '../../shared/cohort-regex.js';
import { createRepoSyncer } from './sync.repo-sync.js';
import type { CohortRule } from '../../shared/types/index.js';
import type { ActivityLogService } from '../activity-log/activity-log.service.js';
export { parsePRsToSubmissions } from './sync.pr-parser.js';

export function createSyncService(deps: {
  memberRepo: MemberRepository;
  missionRepoRepo: MissionRepoRepository;
  submissionRepo: SubmissionRepository;
  workspaceRepo: WorkspaceRepository;
  bannedWordRepo: BannedWordRepository;
  ignoredDomainRepo: IgnoredDomainRepository;
  cohortRepoRepo: CohortRepoRepository;
  activityLogService: ActivityLogService;
}) {
  const {
    memberRepo,
    missionRepoRepo,
    submissionRepo,
    workspaceRepo,
    bannedWordRepo,
    ignoredDomainRepo,
    cohortRepoRepo,
    activityLogService,
  } = deps;

  const { syncRepo } = createRepoSyncer({
    memberRepo,
    missionRepoRepo,
    submissionRepo,
    bannedWordRepo,
    ignoredDomainRepo,
  });

  const runRepos = async (
    octokit: Octokit,
    workspaceId: number,
    repos: { id: number; name: string; track?: string | null; lastSyncAt?: Date | null }[],
    cohortRules: CohortRule[],
    org: string,
    logPrefix: string,
    onProgress?: (step: { repo: string; done: number; total: number; synced: number }) => void,
    signal?: AbortSignal,
  ) => {
    let totalSynced = 0;
    let reposSynced = 0;

    for (let i = 0; i < repos.length; i++) {
      if (signal?.aborted) throw new Error('cancelled');
      const repo = repos[i]!;
      try {
        const { synced } = await syncRepo(octokit, workspaceId, org, repo, cohortRules, undefined, signal);
        totalSynced += synced;
        reposSynced++;
        onProgress?.({ repo: repo.name, done: i + 1, total: repos.length, synced });
        if (synced > 0) {
          await activityLogService.addLog('sync', `${logPrefix}: [${repo.name}] synced ${synced} items`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await activityLogService.addLog('sync_error', `${logPrefix} Failed: [${repo.name}] - ${message}`);
        onProgress?.({ repo: `${repo.name} (failed)`, done: i + 1, total: repos.length, synced: 0 });
      }
    }

    return { totalSynced, reposSynced };
  };

  const syncWorkspace = async (
    octokit: Octokit,
    workspaceId: number,
    onProgress?: (step: { repo: string; done: number; total: number; synced: number }) => void,
    cohort?: number,
    signal?: AbortSignal,
  ) => {
    const workspace = await workspaceRepo.findByIdOrThrow(workspaceId);
    const cohortRules: CohortRule[] = JSON.parse(workspace.cohortRules);
    const repos = await missionRepoRepo.findMany({ workspaceId });
    const activeRepos = repos.filter((r) => {
      if (r.status !== 'active') return false;
      if (cohort != null && !parseCohorts(r.cohorts).includes(cohort)) return false;
      return true;
    });
    const result = await runRepos(
      octokit,
      workspaceId,
      activeRepos,
      cohortRules,
      workspace.githubOrg,
      'Workspace Sync',
      onProgress,
      signal,
    );
    await workspaceRepo.touch(workspaceId);
    return result;
  };

  const syncContinuousRepos = async (
    octokit: Octokit,
    workspaceId: number,
    onProgress?: (step: { repo: string; done: number; total: number; synced: number }) => void,
    signal?: AbortSignal,
  ) => {
    const workspace = await workspaceRepo.findByIdOrThrow(workspaceId);
    const cohortRules: CohortRule[] = JSON.parse(workspace.cohortRules);
    const repos = await missionRepoRepo.findMany({ workspaceId });
    const continuousRepos = repos.filter((r) => r.status === 'active' && r.syncMode === 'continuous');
    return runRepos(
      octokit,
      workspaceId,
      continuousRepos,
      cohortRules,
      workspace.githubOrg,
      'Continuous Sync',
      onProgress,
      signal,
    );
  };

  const syncCohortRepoList = async (
    octokit: Octokit,
    workspaceId: number,
    cohort: number,
    onProgress?: (step: { repo: string; done: number; total: number; synced: number }) => void,
    signal?: AbortSignal,
  ) => {
    const workspace = await workspaceRepo.findByIdOrThrow(workspaceId);
    const cohortRules: CohortRule[] = JSON.parse(workspace.cohortRules);
    const cohortRepos = await cohortRepoRepo.findByCohort(workspaceId, cohort);

    let totalSynced = 0;
    let reposSynced = 0;
    for (let i = 0; i < cohortRepos.length; i++) {
      if (signal?.aborted) throw new Error('cancelled');
      const missionRepo = cohortRepos[i]!.missionRepo;
      try {
        const { synced } = await syncRepo(
          octokit,
          workspaceId,
          workspace.githubOrg,
          {
            id: missionRepo.id,
            name: missionRepo.name,
            track: missionRepo.track,
            lastSyncAt: null,
          },
          cohortRules,
          undefined,
          signal,
        );
        totalSynced += synced;
        reposSynced++;
        onProgress?.({ repo: missionRepo.name, done: i + 1, total: cohortRepos.length, synced });
      } catch (err) {
        if (err instanceof Error && err.message === 'cancelled') throw err;
        const message = err instanceof Error ? err.message : String(err);
        await activityLogService.addLog('sync_error', `Cohort Sync Failed: [${missionRepo.name}] - ${message}`);
        onProgress?.({ repo: `${missionRepo.name} (failed)`, done: i + 1, total: cohortRepos.length, synced: 0 });
      }
    }

    return { totalSynced, reposSynced };
  };

  const syncMemberPRs = async (
    octokit: Octokit,
    workspaceId: number,
    githubId: string,
    onProgress?: (step: { repo: string; done: number; total: number; synced: number }) => void,
    signal?: AbortSignal,
  ) => {
    const workspace = await workspaceRepo.findByIdOrThrow(workspaceId);
    const cohortRules: CohortRule[] = JSON.parse(workspace.cohortRules);
    const repos = await missionRepoRepo.findMany({ workspaceId });
    const activeRepos = repos.filter((r) => r.status === 'active');

    let totalSynced = 0;
    let reposSynced = 0;
    for (let i = 0; i < activeRepos.length; i++) {
      if (signal?.aborted) throw new Error('cancelled');
      const repo = activeRepos[i]!;
      try {
        const { synced } = await syncRepo(
          octokit,
          workspaceId,
          workspace.githubOrg,
          {
            id: repo.id,
            name: repo.name,
            track: repo.track,
            lastSyncAt: repo.lastSyncAt,
          },
          cohortRules,
          undefined,
          signal,
          githubId,
        );
        totalSynced += synced;
        if (synced > 0) reposSynced++;
        onProgress?.({ repo: repo.name, done: i + 1, total: activeRepos.length, synced });
      } catch (err) {
        if (err instanceof Error && err.message === 'cancelled') throw err;
        const message = err instanceof Error ? err.message : String(err);
        await activityLogService.addLog('sync_error', `Member Sync Failed: [${repo.name}] - ${message}`);
        onProgress?.({ repo: `${repo.name} (failed)`, done: i + 1, total: activeRepos.length, synced: 0 });
      }
    }

    if (totalSynced > 0) {
      await activityLogService.addLog('sync', `Member PR Sync: [${githubId}] synced ${totalSynced} items`);
    }

    return { totalSynced, reposSynced };
  };

  return { syncRepo, syncWorkspace, syncContinuousRepos, syncCohortRepoList, syncMemberPRs };
}

export type SyncService = ReturnType<typeof createSyncService>;
