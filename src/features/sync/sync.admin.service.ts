import type { Octokit } from '@octokit/rest';
import type { CohortRepoRepository } from '../../db/repositories/cohort-repo.repository.js';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { MissionRepoRepository } from '../../db/repositories/mission-repo.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { SyncService } from './sync.service.js';

export function createSyncAdminService(deps: {
  cohortRepoRepo: CohortRepoRepository;
  memberRepo: MemberRepository;
  missionRepoRepo: MissionRepoRepository;
  workspaceService: WorkspaceService;
  syncService: SyncService;
  octokit: Octokit;
}) {
  const { cohortRepoRepo, memberRepo, missionRepoRepo, workspaceService, syncService, octokit } = deps;

  return {
    getAdminStatus: async (): Promise<{ memberCount: number; repoCount: number; lastSyncAt: Date | null }> => {
      const workspace = await workspaceService.getOrThrow().catch(() => null);
      const [memberCount, repoCount] = await Promise.all([memberRepo.count(), missionRepoRepo.count()]);
      return { memberCount, repoCount, lastSyncAt: workspace?.updatedAt ?? null };
    },

    syncWorkspace: async (
      onProgress?: (step: { repo: string; done: number; total: number; synced: number }) => void,
      cohort?: number,
    ) => {
      const workspace = await workspaceService.getOrThrow();
      return syncService.syncWorkspace(octokit, workspace.id, onProgress, cohort);
    },

    syncContinuous: async (
      onProgress?: (step: { repo: string; done: number; total: number; synced: number }) => void,
    ) => {
      const workspace = await workspaceService.getOrThrow();
      return syncService.syncContinuousRepos(octokit, workspace.id, onProgress);
    },

    syncCohortRepoList: async (
      cohort: number,
      onProgress?: (step: { repo: string; done: number; total: number; synced: number }) => void,
    ) => {
      const context = await workspaceService.getSyncContext();
      const cohortRepos = await cohortRepoRepo.findByCohort(context.id, cohort);

      let totalSynced = 0;
      let reposSynced = 0;
      for (let i = 0; i < cohortRepos.length; i++) {
        const missionRepo = cohortRepos[i]!.missionRepo;
        try {
          const { synced } = await syncService.syncRepo(
            octokit,
            context.id,
            context.githubOrg,
            {
              id: missionRepo.id,
              name: missionRepo.name,
              track: missionRepo.track,
              lastSyncAt: null, // cohort-repos sync usually ignores history
            },
            context.cohortRules,
          );
          totalSynced += synced;
          reposSynced++;
          onProgress?.({ repo: missionRepo.name, done: i + 1, total: cohortRepos.length, synced });
        } catch (err) {
          // Log is already handled within syncRepo or we can add it here if needed
          // Since syncRepo doesn't log its own errors (the callers do), I should add logging here if I want it.
          // In sync.service.ts, the callers (syncContinuousRepos etc) log.
          // syncAdminService has access to workspaceService but not activityLogService directly unless I inject it.
          // Actually, syncService should probably handle its own detailed logging if we want it everywhere.
          // But for now, I'll just keep it consistent.
          onProgress?.({ repo: `${missionRepo.name} (failed)`, done: i + 1, total: cohortRepos.length, synced: 0 });
        }
      }

      return { totalSynced, reposSynced };
    },
  };
}

export type SyncAdminService = ReturnType<typeof createSyncAdminService>;
