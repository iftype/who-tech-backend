import type { SyncQueueJob } from '../../lib/types.js';
import type { RecentSyncJob } from '../../lib/types.js';
import { Table, TBody, THead, Td, Th } from '../../components/ui/Table.js';
import { Badge, type BadgeTone } from '../../components/ui/Badge.js';

const JOB_STATUS_TONE: Record<string, BadgeTone> = { completed: 'success', failed: 'danger', running: 'primary' };

export function RecentJobsTable({ jobs }: { jobs: (SyncQueueJob | RecentSyncJob)[] }) {
  return (
    <div className="bg-white border border-base-200 rounded p-4">
      <h3 className="text-xs font-semibold text-base-600 mb-3">최근 싱크 작업 ({jobs.length})</h3>
      <div className="max-h-64 overflow-y-auto rounded border border-base-200">
        <Table size="xs">
          <THead>
            <tr>
              <Th size="inherit">시작</Th>
              <Th size="inherit">종류</Th>
              <Th size="inherit">상태</Th>
              <Th size="inherit">메시지</Th>
            </tr>
          </THead>
          <TBody>
            {jobs.map((j) => {
              const isQueueJob = !('repoName' in j);
              const queueJob = j as SyncQueueJob;
              const repoJob = j as RecentSyncJob;
              return (
                <tr key={j.id} className="hover:bg-base-50">
                  <Td className="text-base-500 whitespace-nowrap">
                    {isQueueJob
                      ? new Date(queueJob.completedAt ?? queueJob.createdAt).toLocaleString('ko-KR')
                      : repoJob.startedAt
                        ? new Date(repoJob.startedAt).toLocaleString('ko-KR')
                        : '—'}
                  </Td>
                  <Td>
                    {isQueueJob ? (
                      <Badge emphasis="subtle" tone="accent">
                        {queueJob.type === 'workspace' ? '전체' : queueJob.type === 'continuous' ? '연속' : '기수레포'}
                        {queueJob.cohort != null ? ` (${queueJob.cohort}기)` : ''}
                      </Badge>
                    ) : (
                      <Badge emphasis="subtle" tone={repoJob.repoName ? 'primary' : 'success'}>
                        {repoJob.repoName ? '레포' : '블로그'}
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={JOB_STATUS_TONE[isQueueJob ? queueJob.status : repoJob.status] ?? 'base'}>
                      {isQueueJob ? queueJob.status : repoJob.status}
                    </Badge>
                  </Td>
                  <Td className="text-base-700 truncate max-w-[300px]">
                    {isQueueJob
                      ? typeof queueJob.result?.totalSynced === 'number'
                        ? `✓ ${queueJob.result.totalSynced}개`
                        : (queueJob.error ?? '—')
                      : `${repoJob.repoName ? `${repoJob.repoName} — ` : ''}${repoJob.message}`}
                  </Td>
                </tr>
              );
            })}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
