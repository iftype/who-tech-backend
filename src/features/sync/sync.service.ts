import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { MissionRepoRepository } from '../../db/repositories/mission-repo.repository.js';
import type { SubmissionRepository } from '../../db/repositories/submission.repository.js';
import type { WorkspaceRepository } from '../../db/repositories/workspace.repository.js';
import type { BannedWordRepository } from '../../db/repositories/banned-word.repository.js';
import type { IgnoredDomainRepository } from '../../db/repositories/ignored-domain.repository.js';
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
  ) => {
    let totalSynced = 0;
    let reposSynced = 0;

    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i]!;
      try {
        const { synced } = await syncRepo(octokit, workspaceId, org, repo, cohortRules);
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
    );
    await workspaceRepo.touch(workspaceId);
    return result;
  };

  const syncContinuousRepos = async (
    octokit: Octokit,
    workspaceId: number,
    onProgress?: (step: { repo: string; done: number; total: number; synced: number }) => void,
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
    );
  };

  return { syncRepo, syncWorkspace, syncContinuousRepos };
}

export type SyncService = ReturnType<typeof createSyncService>;
