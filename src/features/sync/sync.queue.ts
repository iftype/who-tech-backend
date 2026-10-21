import { randomUUID } from 'crypto';
import type { Octokit } from '@octokit/rest';
import type { SyncService } from './sync.service.js';
import type { ActivityLogService } from '../activity-log/index.js';
import type { WorkspaceService } from '../workspace/index.js';
import { CancelledError } from '../../shared/errors.js';
import type { SyncJobRecordData, SyncJobRepository } from '../../db/repositories/sync-job.repository.js';
import type {
  BlogSyncResult,
  BlogSyncSource,
  RepoSyncFailure,
  RepoSyncRunner,
  SyncJobProgress,
  SyncProgress,
  WorkspaceBlogSyncRunner,
} from './sync.ports.js';

export type { SyncJobProgress } from './sync.ports.js';

export type SyncJobType = 'workspace' | 'continuous' | 'cohort-repos' | 'repo' | 'member' | 'blog';

export type SyncJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * 레인: 같은 레인 안에서는 한 번에 하나만 돈다. GitHub를 쓰는 작업끼리는 같은 레포를 동시에 쓰지 않게 한 줄로,
 * 블로그(RSS)는 GitHub 작업 뒤에서 기다릴 이유가 없어 자기 줄로 (blog-check cron이 긴 전체 싱크에 막히지 않는다)
 */
export type SyncLane = 'github' | 'blog';

export const LANE_OF: Record<SyncJobType, SyncLane> = {
  workspace: 'github',
  continuous: 'github',
  'cohort-repos': 'github',
  repo: 'github',
  member: 'github',
  blog: 'blog',
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
  /** member 작업: 어느 멤버의 PR을 다시 모으나 */
  githubId?: string;
  blogSource?: BlogSyncSource;
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
  /** 블로그 작업 결과: 삭제·실패 목록까지 (blog-check 워크플로가 읽는다) */
  blogResult?: BlogSyncResult;
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

export type EnqueueOptions = {
  cohort?: number | undefined;
  repoId?: number | undefined;
  githubId?: string | undefined;
  blogSource?: BlogSyncSource | undefined;
  label?: string | undefined;
  /** 대기·완료 활동 로그를 남기지 않는다 (10분 cron처럼 자주 오는 직접 요청). 실패·취소는 남긴다 */
  quiet?: boolean;
};

/** 같은 작업인지 가를 열쇠 (종류 + 기수 또는 멤버) */
export type JobKey = { cohort?: number | undefined; githubId?: string | undefined };

export function createSyncQueue(deps: {
  syncService: SyncService;
  activityLogService: ActivityLogService;
  workspaceService: WorkspaceService;
  octokit: Octokit;
  repoService: RepoSyncRunner;
  blogAdminService: WorkspaceBlogSyncRunner;
  /** 있으면 작업 상태를 DB에 적어 재시작 뒤에도 남긴다. 없으면(테스트) 메모리만 */
  syncJobRepo?: SyncJobRepository;
}) {
  const { syncService, activityLogService, workspaceService, octokit, repoService, blogAdminService, syncJobRepo } =
    deps;

  const jobs: SyncJob[] = [];
  const processing: Record<SyncLane, boolean> = { github: false, blog: false };
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

  // 기록은 실행을 막지 않는다: 적지 못해도 작업은 돌고, 로그만 남긴다
  const persist = (job: SyncJob): void => {
    if (!syncJobRepo) return;
    syncJobRepo.upsert(toRecord(job)).catch((error: unknown) => console.error('[sync-queue] 작업 기록 실패', error));
  };

  const pruneFinished = (now: number): void => {
    syncJobRepo
      ?.deleteCompletedBefore(new Date(now - FINISHED_JOB_TTL_MS))
      .catch((error: unknown) => console.error('[sync-queue] 작업 기록 정리 실패', error));
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
    member: async (job, { signal, onProgress }) => {
      if (!job.githubId) throw new Error('githubId is required for member job');
      return syncService.syncMemberPRs(octokit, await workspaceId(), job.githubId, onProgress, signal);
    },
    blog: async (job, { onStep }) => {
      const blogResult = await blogAdminService.executeWorkspaceBlogSync(job.blogSource ?? 'manual', onStep);
      job.blogResult = blogResult;
      return { totalSynced: blogResult.synced, reposSynced: 1 };
    },
  };

  const enqueue = (type: SyncJobType, options: EnqueueOptions = {}): string => {
    const { cohort, repoId, githubId, blogSource, label, quiet } = options;
    pruneFinished(Date.now());
    const id = randomUUID();
    const job: SyncJob = {
      id,
      type,
      ...(cohort != null ? { cohort } : {}),
      ...(repoId != null ? { repoId } : {}),
      ...(githubId != null ? { githubId } : {}),
      ...(blogSource != null ? { blogSource } : {}),
      ...(label != null ? { label } : {}),
      ...(quiet ? { quiet } : {}),
      status: 'queued',
      createdAt: new Date(),
      abortController: new AbortController(),
    };
    jobs.push(job);
    persist(job);
    if (!quiet) {
      const detail = [
        cohort != null ? ` cohort=${cohort}` : '',
        repoId != null ? ` repoId=${repoId}` : '',
        githubId != null ? ` githubId=${githubId}` : '',
        blogSource != null ? ` source=${blogSource}` : '',
      ].join('');
      void activityLogService.addLog('sync', `Job queued: ${type}${detail} (id=${id})`);
    }
    processLoop(LANE_OF[type]);
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
      persist(job);
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

  /** 같은 종류(그리고 같은 기수·멤버)로 대기 중이거나 실행 중인 작업 (같은 싱크를 두 번 쌓지 않으려고) */
  const findActive = (type: SyncJobType, key: JobKey = {}): Omit<SyncJob, 'abortController'> | undefined => {
    const job = jobs.find(
      (j) =>
        j.type === type &&
        j.cohort === key.cohort &&
        j.githubId === key.githubId &&
        (j.status === 'queued' || j.status === 'running'),
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

  // 레인마다 워커 하나. 같은 레인의 작업은 들어온 순서대로 하나씩
  const processLoop = async (lane: SyncLane): Promise<void> => {
    if (processing[lane]) return;
    processing[lane] = true;

    try {
      while (true) {
        const job = jobs.find((j) => j.status === 'queued' && LANE_OF[j.type] === lane);
        if (!job) break;

        if (job.abortController.signal.aborted) {
          job.status = 'cancelled';
          job.completedAt = new Date();
          persist(job);
          emitDone(job);
          continue;
        }

        job.status = 'running';
        job.startedAt = new Date();
        persist(job);

        const onProgress = (step: SyncJobProgress): void => {
          job.progress = step;
          emitProgress(job.id, step);
        };

        const onStep = (step: SyncProgress): void => {
          job.step = step;
          onProgress({ repo: step.phase, done: step.processed, total: step.total, synced: step.synced });
        };

        try {
          const result = await handlers[job.type](job, { signal: job.abortController.signal, onProgress, onStep });

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

        persist(job);
        emitDone(job);
      }
    } finally {
      processing[lane] = false;
    }
  };

  /**
   * 부팅 때 한 번: 끝을 못 적은 기록(대기·실행 중)은 "서버 재시작"으로 실패 처리하고,
   * TTL 안의 기록을 목록 앞에 되살린다(실행하지 않는다 — 어드민이 재시작 전 작업을 볼 수 있게)
   */
  const restore = async (): Promise<number> => {
    if (!syncJobRepo) return 0;
    const now = new Date();
    await syncJobRepo.closeUnfinished('server restarted', now);
    const rows = await syncJobRepo.findRecent(new Date(now.getTime() - FINISHED_JOB_TTL_MS));
    const known = new Set(jobs.map((j) => j.id));
    const restored = rows.filter((row) => !known.has(row.id)).map(fromRecord);
    jobs.unshift(...restored);
    return restored.length;
  };

  return { enqueue, getJobs, getJob, findActive, waitFor, cancel, subscribeProgress, subscribeDone, restore };
}

function toRecord(job: SyncJob): SyncJobRecordData {
  const detail =
    job.step || job.repoResult || job.blogResult
      ? JSON.stringify({ step: job.step, repoResult: job.repoResult, blogResult: job.blogResult })
      : null;
  return {
    id: job.id,
    type: job.type,
    lane: LANE_OF[job.type],
    status: job.status,
    cohort: job.cohort ?? null,
    repoId: job.repoId ?? null,
    githubId: job.githubId ?? null,
    blogSource: job.blogSource ?? null,
    label: job.label ?? null,
    quiet: job.quiet ?? false,
    error: job.error ?? null,
    result: job.result ? JSON.stringify(job.result) : null,
    detail,
    createdAt: job.createdAt,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
  };
}

// 기록에서 되살린 작업. 이미 끝난 것만 되살리므로 abortController는 쓰이지 않는다
function fromRecord(row: SyncJobRecordData): SyncJob {
  const detail = row.detail ? (JSON.parse(row.detail) as Pick<SyncJob, 'step' | 'repoResult' | 'blogResult'>) : {};
  return {
    id: row.id,
    type: row.type as SyncJobType,
    status: row.status as SyncJobStatus,
    createdAt: row.createdAt,
    ...(row.cohort != null ? { cohort: row.cohort } : {}),
    ...(row.repoId != null ? { repoId: row.repoId } : {}),
    ...(row.githubId != null ? { githubId: row.githubId } : {}),
    ...(row.blogSource != null ? { blogSource: row.blogSource as BlogSyncSource } : {}),
    ...(row.label != null ? { label: row.label } : {}),
    ...(row.quiet ? { quiet: true } : {}),
    ...(row.error != null ? { error: row.error } : {}),
    ...(row.result != null ? { result: JSON.parse(row.result) as SyncJobResult } : {}),
    ...(row.startedAt != null ? { startedAt: row.startedAt } : {}),
    ...(row.completedAt != null ? { completedAt: row.completedAt } : {}),
    ...(detail.step ? { step: detail.step } : {}),
    ...(detail.repoResult ? { repoResult: detail.repoResult } : {}),
    ...(detail.blogResult ? { blogResult: detail.blogResult } : {}),
    abortController: new AbortController(),
  };
}

export type SyncQueue = ReturnType<typeof createSyncQueue>;
