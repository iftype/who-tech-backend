import type { SyncQueueJob } from '../../lib/types.js';
import type { RecentSyncJob } from '../../lib/types.js';
import { Table, TBody, THead, Td, Th } from '../../components/ui/Table.js';

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
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium border bg-accent-50 text-accent-700 border-accent-200">
                        {queueJob.type === 'workspace' ? '전체' : queueJob.type === 'continuous' ? '연속' : '기수레포'}
                        {queueJob.cohort != null ? ` (${queueJob.cohort}기)` : ''}
                      </span>
                    ) : (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium border ${
                          repoJob.repoName
                            ? 'bg-primary-50 text-primary-700 border-primary-200'
                            : 'bg-success-50 text-success-700 border-success-200'
                        }`}
                      >
                        {repoJob.repoName ? '레포' : '블로그'}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium border ${
                        (isQueueJob ? queueJob.status : repoJob.status) === 'completed'
                          ? 'bg-success-100 text-success-700 border-success-200'
                          : (isQueueJob ? queueJob.status : repoJob.status) === 'failed'
                            ? 'bg-danger-100 text-danger-700 border-danger-200'
                            : (isQueueJob ? queueJob.status : repoJob.status) === 'running'
                              ? 'bg-primary-100 text-primary-700 border-primary-200'
                              : 'bg-base-100 text-base-500 border-base-200'
                      }`}
                    >
                      {isQueueJob ? queueJob.status : repoJob.status}
                    </span>
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
