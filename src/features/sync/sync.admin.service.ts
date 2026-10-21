import type { Octokit } from '@octokit/rest';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { MissionRepoRepository } from '../../db/repositories/mission-repo.repository.js';
import type { WorkspaceService } from '../workspace/index.js';
import type { ActivityLogService } from '../activity-log/index.js';
import type { SyncService } from './sync.service.js';
import type { RepoSyncRunner, WorkspaceBlogSyncRunner } from './sync.ports.js';
import type {
  EnqueueOptions,
  JobKey,
  SyncQueue,
  SyncJob,
  SyncJobProgress,
  SyncJobResult,
  SyncJobType,
} from './sync.queue.js';
import { createSyncQueue } from './sync.queue.js';

// 운영 nginx의 proxy_read_timeout(300초)보다 짧게: 그 전에 응답해야 cron이 504로 실패하지 않는다
export const REQUEST_WAIT_MS = 240_000;

type DirectSyncType = Extract<SyncJobType, 'workspace' | 'continuous' | 'cohort-repos'>;

export type SyncOutcome =
  { done: true; result: SyncJobResult } | { done: false; job: Omit<SyncJob, 'abortController'> };

export function createSyncAdminService(deps: {
  memberRepo: MemberRepository;
  missionRepoRepo: MissionRepoRepository;
  workspaceService: WorkspaceService;
  syncService: SyncService;
  activityLogService: ActivityLogService;
  octokit: Octokit;
  repoService: RepoSyncRunner;
  blogAdminService: WorkspaceBlogSyncRunner;
  requestWaitMs?: number;
}) {
  const { requestWaitMs = REQUEST_WAIT_MS } = deps;
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

  // 직접 부르던 싱크도 큐를 거친다: 큐 작업과 같은 레포를 동시에 쓰지 않게 하고,
  // 같은 싱크가 이미 대기·실행 중이면 새로 쌓지 않고 그 작업에 붙는다 (10분 cron이 긴 작업 뒤에 쌓이지 않게)
  const runInQueue = async (
    type: SyncJobType,
    key: JobKey,
    onProgress: ((step: SyncJobProgress) => void) | undefined,
    waitMs?: number,
  ): Promise<SyncOutcome> => {
    const id = queue.findActive(type, key)?.id ?? queue.enqueue(type, { ...key, quiet: true });
    const unsubscribe = onProgress ? queue.subscribeProgress(id, onProgress) : undefined;
    try {
      const result = await queue.waitFor(id, waitMs);
      if (result) return { done: true, result };
      const job = queue.getJob(id);
      if (!job) throw new Error(`job not found: ${id}`);
      return { done: false, job };
    } finally {
      unsubscribe?.();
    }
  };

  const waitResult = async (outcome: Promise<SyncOutcome>): Promise<SyncJobResult> => {
    const settled = await outcome;
    if (!settled.done) throw new Error('sync did not finish');
    return settled.result;
  };

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

    // SSE 스트림용: 끝날 때까지 기다린다 (진행 이벤트가 오가므로 프록시 시간 제한에 걸리지 않는다)
    syncWorkspace: async (onProgress?: (step: SyncJobProgress) => void, cohort?: number) =>
      waitResult(runInQueue('workspace', { cohort }, onProgress)),

    syncContinuous: async (onProgress?: (step: SyncJobProgress) => void) =>
      waitResult(runInQueue('continuous', {}, onProgress)),

    syncCohortRepoList: async (cohort: number, onProgress?: (step: SyncJobProgress) => void) =>
      waitResult(runInQueue('cohort-repos', { cohort }, onProgress)),

    // POST 요청용: requestWaitMs까지만 기다리고, 그때까지 안 끝나면 작업 정보를 돌려준다 (라우트가 202로 응답)
    requestSync: (type: DirectSyncType, cohort?: number): Promise<SyncOutcome> =>
      runInQueue(type, { cohort }, undefined, requestWaitMs),

    /** 멤버 한 명의 PR 재수집. 같은 멤버가 이미 대기·실행 중이면 그 작업에 붙는다 */
    requestMemberSync: (githubId: string): Promise<SyncOutcome> =>
      runInQueue('member', { githubId }, undefined, requestWaitMs),

    createJob: (type: SyncJobType, options?: EnqueueOptions): string => queue.enqueue(type, options),

    /** 같은 종류로 대기·실행 중인 작업 (블로그 싱크처럼 하나만 돌아야 하는 작업의 dedupe) */
    findActiveJob: (type: SyncJobType, key?: JobKey) => queue.findActive(type, key),

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
