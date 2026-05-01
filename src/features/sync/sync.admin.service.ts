import type { Octokit } from '@octokit/rest';
import type { CohortRepoRepository } from '../../db/repositories/cohort-repo.repository.js';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { MissionRepoRepository } from '../../db/repositories/mission-repo.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { ActivityLogService } from '../activity-log/activity-log.service.js';
import type { SyncService } from './sync.service.js';
import type { RepoService } from '../repo/repo.service.js';
import type { BlogAdminService } from '../blog/blog.admin.service.js';
import type { SyncQueue, SyncJobType } from './sync.queue.js';
import { createSyncQueue } from './sync.queue.js';

export function createSyncAdminService(deps: {
  cohortRepoRepo: CohortRepoRepository;
  memberRepo: MemberRepository;
  missionRepoRepo: MissionRepoRepository;
  workspaceService: WorkspaceService;
  syncService: SyncService;
  activityLogService: ActivityLogService;
  octokit: Octokit;
  repoService: RepoService;
  blogAdminService: BlogAdminService;
}) {
  const {
    memberRepo,
    missionRepoRepo,
    workspaceService,
    syncService,
    activityLogService,
    octokit,
    repoService,
    blogAdminService,
  } = deps;

  const queue: SyncQueue = createSyncQueue({
    syncService,
    activityLogService,
    workspaceService,
    octokit,
    repoService,
    blogAdminService,
  });

  return {
    getAdminStatus: async (): Promise<{
      memberCount: number;
      repoCount: number;
      lastSyncAt: Date | null;
      profileRefreshEnabled: boolean;
      lastProfileRefreshAt: Date | null;
    }> => {
      const workspace = await workspaceService.getOrThrow().catch(() => null);
      const [memberCount, repoCount] = await Promise.all([memberRepo.count(), missionRepoRepo.count()]);
      return {
        memberCount,
        repoCount,
        lastSyncAt: workspace?.updatedAt ?? null,
        profileRefreshEnabled: workspace?.profileRefreshEnabled ?? true,
        lastProfileRefreshAt: workspace?.lastProfileRefreshAt ?? null,
      };
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
      const workspace = await workspaceService.getOrThrow();
      return syncService.syncCohortRepoList(octokit, workspace.id, cohort, onProgress);
    },

    createJob: (type: SyncJobType, cohort?: number, repoId?: number, blogSource?: string): string => {
      return queue.enqueue(type, cohort, repoId, blogSource);
    },

    getJobs: () => queue.getJobs(),

    getJob: (id: string) => queue.getJob(id),

    cancelJob: (id: string): boolean => {
      return queue.cancel(id);
    },

    subscribeProgress: (
      id: string,
      cb: (progress: { repo: string; done: number; total: number; synced: number }) => void,
    ) => {
      return queue.subscribeProgress(id, cb);
    },

    subscribeDone: (id: string, cb: (job: unknown) => void) => {
      return queue.subscribeDone(id, cb as Parameters<typeof queue.subscribeDone>[1]);
    },

    getGithubStatus: async () => {
      try {
        const { data } = await octokit.rest.rateLimit.get();
        return {
          ok: true,
          remaining: data.rate.remaining,
          limit: data.rate.limit,
          resetAt: new Date(data.rate.reset * 1000).toISOString(),
        };
      } catch {
        return { ok: false, remaining: 0, limit: 0, resetAt: null };
      }
    },

    getQueue: (): SyncQueue => queue,
  };
}

export type SyncAdminService = ReturnType<typeof createSyncAdminService>;
