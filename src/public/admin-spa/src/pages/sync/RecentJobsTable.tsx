import type { SyncQueueJob } from '../../lib/types.js';
import type { RecentSyncJob } from '../../lib/types.js';

export function RecentJobsTable({ jobs }: { jobs: (SyncQueueJob | RecentSyncJob)[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded p-4">
      <h3 className="text-xs font-semibold text-gray-600 mb-3">최근 싱크 작업 ({jobs.length})</h3>
      <div className="max-h-64 overflow-y-auto rounded border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left font-medium text-gray-500 px-3 py-2">시작</th>
              <th className="text-left font-medium text-gray-500 px-3 py-2">종류</th>
              <th className="text-left font-medium text-gray-500 px-3 py-2">상태</th>
              <th className="text-left font-medium text-gray-500 px-3 py-2">메시지</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {jobs.map((j) => {
              const isQueueJob = !('repoName' in j);
              const queueJob = j as SyncQueueJob;
              const repoJob = j as RecentSyncJob;
              return (
                <tr key={j.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                    {isQueueJob
                      ? new Date(queueJob.completedAt ?? queueJob.createdAt).toLocaleString('ko-KR')
                      : repoJob.startedAt
                        ? new Date(repoJob.startedAt).toLocaleString('ko-KR')
                        : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {isQueueJob ? (
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium border bg-purple-50 text-purple-700 border-purple-200">
                        {queueJob.type === 'workspace' ? '전체' : queueJob.type === 'continuous' ? '연속' : '기수레포'}
                        {queueJob.cohort != null ? ` (${queueJob.cohort}기)` : ''}
                      </span>
                    ) : (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium border ${
                          repoJob.repoName
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-green-50 text-green-700 border-green-200'
                        }`}
                      >
                        {repoJob.repoName ? '레포' : '블로그'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium border ${
                        (isQueueJob ? queueJob.status : repoJob.status) === 'completed'
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : (isQueueJob ? queueJob.status : repoJob.status) === 'failed'
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : (isQueueJob ? queueJob.status : repoJob.status) === 'running'
                              ? 'bg-blue-100 text-blue-700 border-blue-200'
                              : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}
                    >
                      {isQueueJob ? queueJob.status : repoJob.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700 truncate max-w-[300px]">
                    {isQueueJob
                      ? typeof queueJob.result?.totalSynced === 'number'
                        ? `✓ ${queueJob.result.totalSynced}개`
                        : (queueJob.error ?? '—')
                      : `${repoJob.repoName ? `${repoJob.repoName} — ` : ''}${repoJob.message}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
