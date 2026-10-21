import { randomUUID } from 'crypto';
import type { Octokit } from '@octokit/rest';
import type { SyncService } from './sync.service.js';
import type { ActivityLogService } from '../activity-log/index.js';
import type { WorkspaceService } from '../workspace/index.js';
import { CancelledError } from '../../shared/errors.js';
import type { RepoSyncFailure, RepoSyncRunner, SyncProgress, WorkspaceBlogSyncRunner } from './sync.ports.js';

export type SyncJobType = 'workspace' | 'continuous' | 'cohort-repos' | 'repo' | 'blog';

export type SyncJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type SyncJobProgress = {
  repo: string;
  done: number;
  total: number;
  synced: number;
};

export type SyncJobResult = {
  totalSynced: number;
  reposSynced: number;
};

export type SyncJob = {
  id: string;
  type: SyncJobType;
  cohort?: number;
  repoId?: number;
  blogSource?: string;
  /** 사람이 읽는 대상 이름 (레포 작업이면 레포 이름) */
  label?: string;
  status: SyncJobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress?: SyncJobProgress;
  result?: SyncJobResult;
  error?: string;
  /** 레포·블로그 작업의 단계별 진행 (어드민 레포 탭이 percent·phase를 보여 준다) */
  step?: SyncProgress;
  /** 레포 작업 결과: 실패한 PR 목록까지 */
  repoResult?: { synced: number; failures: RepoSyncFailure[] };
  /** 대기·완료 활동 로그를 남기지 않는다 (10분 cron처럼 자주 오는 직접 요청이 로그를 덮지 않게). 실패·취소는 남긴다 */
  quiet?: boolean;
  abortController: AbortController;
};

type JobContext = {
  signal: AbortSignal;
  onProgress: (step: SyncJobProgress) => void;
  onStep: (step: SyncProgress) => void;
};

type JobHandler = (job: SyncJob, ctx: JobContext) => Promise<SyncJobResult>;

type ProgressSubscriber = (progress: SyncJobProgress) => void;

// 끝난 작업은 이 시간이 지나면 목록에서 지운다 (프로세스가 살아 있는 동안 작업 배열이 끝없이 커지지 않게)
export const FINISHED_JOB_TTL_MS = 6 * 60 * 60 * 1000;
type DoneSubscriber = (job: SyncJob) => void;

export function createSyncQueue(deps: {
  syncService: SyncService;
  activityLogService: ActivityLogService;
  workspaceService: WorkspaceService;
  octokit: Octokit;
  repoService: RepoSyncRunner;
  blogAdminService: WorkspaceBlogSyncRunner;
}) {
  const { syncService, activityLogService, workspaceService, octokit, repoService, blogAdminService } = deps;

  const jobs: SyncJob[] = [];
  let processing = false;
  // 실패한 작업의 원래 에러. 기다리던 요청이 같은 에러(같은 상태 코드)로 실패하도록 문자열과 따로 보관한다
  const failures = new Map<string, unknown>();

  const progressSubs = new Map<string, Set<ProgressSubscriber>>();
  const doneSubs = new Map<string, Set<DoneSubscriber>>();

  const emitProgress = (jobId: string, progress: SyncJobProgress): void => {
    const subs = progressSubs.get(jobId);
    if (subs) {
      for (const cb of subs) {
        try {
          cb(progress);
        } catch {
          /* subscriber error, ignore */
        }
      }
    }
  };

  const emitDone = (job: SyncJob): void => {
    const subs = doneSubs.get(job.id);
    if (subs) {
      for (const cb of subs) {
        try {
          cb(job);
        } catch {
          /* subscriber error, ignore */
        }
      }
    }
  };

  const pruneFinished = (now: number): void => {
    for (let i = jobs.length - 1; i >= 0; i--) {
      const job = jobs[i];
      if (job?.completedAt && now - job.completedAt.getTime() > FINISHED_JOB_TTL_MS) {
        jobs.splice(i, 1);
        progressSubs.delete(job.id);
        doneSubs.delete(job.id);
        failures.delete(job.id);
      }
    }
  };

  const workspaceId = async (): Promise<number> => (await workspaceService.getOrThrow()).id;

  // 작업 종류별 실행 방법. 종류를 추가할 때 if/else를 늘리지 않고 여기 한 줄을 더한다
  const handlers: Record<SyncJobType, JobHandler> = {
    workspace: async (job, { signal, onProgress }) =>
      syncService.syncWorkspace(octokit, await workspaceId(), onProgress, job.cohort, signal),
    continuous: async (_job, { signal, onProgress }) =>
      syncService.syncContinuousRepos(octokit, await workspaceId(), onProgress, signal),
    'cohort-repos': async (job, { signal, onProgress }) => {
      if (job.cohort == null) throw new Error('cohort is required for cohort-repos job');
      return syncService.syncCohortRepoList(octokit, await workspaceId(), job.cohort, onProgress, signal);
    },
    repo: async (job, { onStep }) => {
      if (job.repoId == null) throw new Error('repoId is required for repo job');
      const repoResult = await repoService.executeRepoSync(job.repoId, onStep);
      job.repoResult = { synced: repoResult.synced, failures: repoResult.failures ?? [] };
      return { totalSynced: repoResult.synced, reposSynced: 1 };
    },
    blog: async (job, { onStep }) => {
      const blogResult = await blogAdminService.executeWorkspaceBlogSync(
        (job.blogSource as 'manual' | 'github-actions' | 'scheduler') ?? 'manual',
        onStep,
      );
      return { totalSynced: blogResult.synced, reposSynced: 1 };
    },
  };

  const enqueue = (
    type: SyncJobType,
    cohort?: number,
    repoId?: number,
    blogSource?: string,
    label?: string,
    quiet?: boolean,
  ): string => {
    pruneFinished(Date.now());
    const id = randomUUID();
    const job: SyncJob = {
      id,
      type,
      ...(cohort != null ? { cohort } : {}),
      ...(repoId != null ? { repoId } : {}),
      ...(blogSource != null ? { blogSource } : {}),
      ...(label != null ? { label } : {}),
      ...(quiet ? { quiet } : {}),
      status: 'queued',
      createdAt: new Date(),
      abortController: new AbortController(),
    };
    jobs.push(job);
    if (!quiet) {
      void activityLogService.addLog(
        'sync',
        `Job queued: ${type}${cohort != null ? ` cohort=${cohort}` : ''}${repoId != null ? ` repoId=${repoId}` : ''}${blogSource != null ? ` source=${blogSource}` : ''} (id=${id})`,
      );
    }
    processLoop();
    return id;
  };

  const getJobs = (): Omit<SyncJob, 'abortController'>[] => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return jobs.map(({ abortController, ...rest }) => rest);
  };

  const getJob = (id: string): Omit<SyncJob, 'abortController'> | undefined => {
    const job = jobs.find((j) => j.id === id);
    if (!job) return undefined;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { abortController, ...rest } = job;
    return rest;
  };

  const cancel = (id: string): boolean => {
    const job = jobs.find((j) => j.id === id);
    if (!job) return false;
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return false;
    job.abortController.abort();
    if (job.status === 'queued') {
      job.status = 'cancelled';
      job.completedAt = new Date();
      emitDone(job);
    }
    return true;
  };

  const subscribeProgress = (id: string, cb: ProgressSubscriber): (() => void) => {
    if (!progressSubs.has(id)) progressSubs.set(id, new Set());
    progressSubs.get(id)!.add(cb);
    return () => {
      progressSubs.get(id)?.delete(cb);
    };
  };

  const subscribeDone = (id: string, cb: DoneSubscriber): (() => void) => {
    if (!doneSubs.has(id)) doneSubs.set(id, new Set());
    doneSubs.get(id)!.add(cb);
    return () => {
      doneSubs.get(id)?.delete(cb);
    };
  };

  /** 같은 종류·기수로 대기 중이거나 실행 중인 작업 (같은 싱크를 두 번 쌓지 않으려고) */
  const findActive = (type: SyncJobType, cohort?: number): Omit<SyncJob, 'abortController'> | undefined => {
    const job = jobs.find(
      (j) => j.type === type && j.cohort === cohort && (j.status === 'queued' || j.status === 'running'),
    );
    return job ? getJob(job.id) : undefined;
  };

  /**
   * 작업이 끝날 때까지 기다린다. 완료면 결과, 실패면 원래 에러, 취소면 CancelledError로 끝난다.
   * timeoutMs가 지나도 안 끝나면 undefined (작업은 큐에서 계속 돈다)
   */
  const waitFor = (id: string, timeoutMs?: number): Promise<SyncJobResult | undefined> =>
    new Promise((resolve, reject) => {
      const settle = (job: SyncJob): void => {
        if (job.status === 'completed') resolve(job.result);
        else if (job.status === 'cancelled') reject(new CancelledError());
        else reject(failures.get(job.id) ?? new Error(job.error ?? 'sync failed'));
      };

      const job = jobs.find((j) => j.id === id);
      if (!job) {
        reject(new Error(`job not found: ${id}`));
        return;
      }
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        settle(job);
        return;
      }

      const timer =
        timeoutMs != null
          ? setTimeout(() => {
              unsubscribe();
              resolve(undefined);
            }, timeoutMs)
          : undefined;
      const unsubscribe = subscribeDone(id, (done) => {
        unsubscribe();
        clearTimeout(timer);
        settle(done);
      });
    });

  const processLoop = async (): Promise<void> => {
    if (processing) return;
    processing = true;

    try {
      while (true) {
        const job = jobs.find((j) => j.status === 'queued');
        if (!job) break;

        if (job.abortController.signal.aborted) {
          job.status = 'cancelled';
          job.completedAt = new Date();
          emitDone(job);
          continue;
        }

        job.status = 'running';
        job.startedAt = new Date();

        const onProgress = (step: SyncJobProgress): void => {
          job.progress = step;
          emitProgress(job.id, step);
        };

        const onStep = (step: SyncProgress): void => {
          job.step = step;
          onProgress({ repo: step.phase, done: step.processed, total: step.total, synced: step.synced });
        };

        try {
          const handler = handlers[job.type];
          if (!handler) throw new Error(`Unknown job type: ${job.type}`);
          const result = await handler(job, { signal: job.abortController.signal, onProgress, onStep });

          job.status = 'completed';
          job.result = result;
          job.completedAt = new Date();
          if (!job.quiet) {
            await activityLogService.addLog(
              'sync',
              `Job completed: ${job.type}${job.cohort != null ? ` cohort=${job.cohort}` : ''} — synced ${result.totalSynced} items across ${result.reposSynced} repos`,
            );
          }
        } catch (err) {
          if (job.abortController.signal.aborted) {
            job.status = 'cancelled';
            job.completedAt = new Date();
            await activityLogService.addLog('sync', `Job cancelled: ${job.type} (id=${job.id})`);
          } else {
            job.status = 'failed';
            job.error = err instanceof Error ? err.message : String(err);
            failures.set(job.id, err);
            job.completedAt = new Date();
            await activityLogService.addLog('sync_error', `Job failed: ${job.type} — ${job.error}`);
          }
        }

        emitDone(job);
      }
    } finally {
      processing = false;
    }
  };

  return { enqueue, getJobs, getJob, findActive, waitFor, cancel, subscribeProgress, subscribeDone };
}

export type SyncQueue = ReturnType<typeof createSyncQueue>;
