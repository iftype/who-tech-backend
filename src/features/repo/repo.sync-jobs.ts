import type { SyncAdminService } from '../sync/index.js';

type QueueJob = NonNullable<ReturnType<SyncAdminService['getJob']>>;

const WAITING = { total: 0, processed: 0, synced: 0, percent: 0, phase: '대기 중' };

// 레포 싱크 작업은 싱크 큐 하나에서 돈다. 어드민 레포 탭은 예전 레포 전용 작업의 모양을 읽으므로
// 큐 작업을 그 모양으로 바꿔 준다 (응답 계약 유지)
export function toRepoSyncJob(job: QueueJob) {
  const name = job.label ?? `repo#${job.repoId ?? '?'}`;
  const step = job.step;
  const message = (() => {
    switch (job.status) {
      case 'queued':
        return `${name} sync 대기 중`;
      case 'running':
        return step ? `${name} sync ${step.phase} (${step.processed}/${step.total})` : `${name} sync 실행 중`;
      case 'completed':
        return `${name} sync 완료`;
      case 'failed':
        return `${name} sync 실패`;
      case 'cancelled':
        return `${name} sync 취소됨`;
    }
  })();

  return {
    id: job.id,
    repoId: job.repoId ?? null,
    repoName: job.label ?? '',
    status: job.status,
    message,
    startedAt: job.createdAt,
    finishedAt: job.completedAt ?? null,
    progress: step ?? WAITING,
    result: job.repoResult ?? null,
    error: job.error ?? null,
  };
}

export function listRepoSyncJobs(syncAdminService: Pick<SyncAdminService, 'getJobs'>) {
  return syncAdminService
    .getJobs()
    .filter((job) => job.type === 'repo')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(toRepoSyncJob);
}
