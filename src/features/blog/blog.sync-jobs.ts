import type { SyncAdminService } from '../sync/index.js';

type QueueJob = NonNullable<ReturnType<SyncAdminService['getJob']>>;

const WAITING = { total: 0, processed: 0, synced: 0, percent: 0, phase: '대기 중' };

// 블로그 싱크도 싱크 큐 하나에서 돈다(블로그 레인). blog-check 워크플로와 어드민은 예전 블로그 작업의 모양
// ({status, message, progress.percent…, result})을 읽으므로 큐 작업을 그 모양으로 바꿔 준다 (응답 계약 유지)
export function toBlogSyncJob(job: QueueJob) {
  const step = job.step;
  const message = (() => {
    switch (job.status) {
      case 'queued':
        return '블로그 sync 대기 중';
      case 'running':
        return step ? `블로그 sync ${step.phase} (${step.processed}/${step.total})` : '블로그 sync 실행 중';
      case 'completed':
        return job.blogResult?.skipped ? '블로그 sync 스킵됨' : '블로그 sync 완료';
      case 'failed':
        return '블로그 sync 실패';
      case 'cancelled':
        return '블로그 sync 취소됨';
    }
  })();

  return {
    id: job.id,
    // 예전 블로그 작업에는 '취소'가 없었다. 폴링하는 쪽(blog-check)은 completed/failed만 보므로 취소는 실패로 알린다
    status: job.status === 'cancelled' ? 'failed' : job.status,
    source: job.blogSource ?? 'manual',
    message,
    startedAt: job.createdAt,
    finishedAt: job.completedAt ?? null,
    progress: step ?? WAITING,
    result: job.blogResult ?? null,
    error: job.status === 'cancelled' ? 'cancelled' : (job.error ?? null),
  };
}

export function listBlogSyncJobs(syncAdminService: Pick<SyncAdminService, 'getJobs'>) {
  return syncAdminService
    .getJobs()
    .filter((job) => job.type === 'blog')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(toBlogSyncJob);
}
