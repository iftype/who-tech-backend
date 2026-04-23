import { randomUUID } from 'crypto';
import type { Octokit } from '@octokit/rest';
import type { SyncService } from './sync.service.js';
import type { ActivityLogService } from '../activity-log/activity-log.service.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';

export type SyncJobType = 'workspace' | 'continuous' | 'cohort-repos';

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
  status: SyncJobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress?: SyncJobProgress;
  result?: SyncJobResult;
  error?: string;
  abortController: AbortController;
};

type ProgressSubscriber = (progress: SyncJobProgress) => void;
type DoneSubscriber = (job: SyncJob) => void;

export function createSyncQueue(deps: {
  syncService: SyncService;
  activityLogService: ActivityLogService;
  workspaceService: WorkspaceService;
  octokit: Octokit;
}) {
  const { syncService, activityLogService, workspaceService, octokit } = deps;

  const jobs: SyncJob[] = [];
  let processing = false;

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

  const enqueue = (type: SyncJobType, cohort?: number): string => {
    const id = randomUUID();
    const job: SyncJob = {
      id,
      type,
      ...(cohort != null ? { cohort } : {}),
      status: 'queued',
      createdAt: new Date(),
      abortController: new AbortController(),
    };
    jobs.push(job);
    void activityLogService.addLog(
      'sync',
      `Job queued: ${type}${cohort != null ? ` cohort=${cohort}` : ''} (id=${id})`,
    );
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

        try {
          let result: SyncJobResult;

          if (job.type === 'workspace') {
            result = await syncService.syncWorkspace(
              octokit,
              (await workspaceService.getOrThrow()).id,
              onProgress,
              job.cohort,
              job.abortController.signal,
            );
          } else if (job.type === 'continuous') {
            result = await syncService.syncContinuousRepos(
              octokit,
              (await workspaceService.getOrThrow()).id,
              onProgress,
              job.abortController.signal,
            );
          } else if (job.type === 'cohort-repos') {
            if (job.cohort == null) {
              throw new Error('cohort is required for cohort-repos job');
            }
            result = await syncService.syncCohortRepoList(
              octokit,
              (await workspaceService.getOrThrow()).id,
              job.cohort,
              onProgress,
              job.abortController.signal,
            );
          } else {
            throw new Error(`Unknown job type: ${job.type}`);
          }

          job.status = 'completed';
          job.result = result;
          job.completedAt = new Date();
          await activityLogService.addLog(
            'sync',
            `Job completed: ${job.type}${job.cohort != null ? ` cohort=${job.cohort}` : ''} — synced ${result.totalSynced} items across ${result.reposSynced} repos`,
          );
        } catch (err) {
          if (job.abortController.signal.aborted) {
            job.status = 'cancelled';
            job.completedAt = new Date();
            await activityLogService.addLog('sync', `Job cancelled: ${job.type} (id=${job.id})`);
          } else {
            job.status = 'failed';
            job.error = err instanceof Error ? err.message : String(err);
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

  return { enqueue, getJobs, getJob, cancel, subscribeProgress, subscribeDone };
}

export type SyncQueue = ReturnType<typeof createSyncQueue>;
