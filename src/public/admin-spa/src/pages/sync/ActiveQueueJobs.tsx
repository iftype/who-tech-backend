import { useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../../components/ui/Toast.js';
import { Badge } from '../../components/ui/Badge.js';
import { Panel, SectionTitle } from '../../components/ui/Section.js';
import { Table, TBody, THead, Td, Th } from '../../components/ui/Table.js';
import type { SyncQueueJob } from '../../lib/types.js';
import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';

// 대기·실행 중인 큐 작업과 취소 버튼
export function ActiveQueueJobs({ jobs }: { jobs: SyncQueueJob[] }) {
  const queryClient = useQueryClient();
  const cancelJobMutation = useMutation({
    mutationFn: (jobId: string) => adminApi.sync.cancelJob(jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.syncQueueJobs() });
      showToast('작업이 취소되었습니다');
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '취소 실패', 'error'),
  });

  return (
    <Panel variant="card">
      <SectionTitle as="h3" size="sm" className="mb-3">
        현재 싱크 작업 ({jobs.length})
      </SectionTitle>
      <div className="max-h-64 overflow-y-auto rounded border border-base-200">
        <Table size="xs">
          <THead>
            <tr>
              <Th size="inherit">시작</Th>
              <Th size="inherit">종류</Th>
              <Th size="inherit">상태</Th>
              <Th size="inherit">진행</Th>
              <Th size="inherit">결과</Th>
              <Th size="inherit">액션</Th>
            </tr>
          </THead>
          <TBody>
            {jobs.map((j) => (
              <tr key={j.id} className="hover:bg-base-50">
                <Td className="text-base-500 whitespace-nowrap">
                  {new Date(j.status === 'running' && j.startedAt ? j.startedAt : j.createdAt).toLocaleString('ko-KR')}
                </Td>
                <Td>
                  <Badge emphasis="subtle" tone="primary">
                    {j.type === 'workspace' ? '전체' : j.type === 'continuous' ? '연속' : '기수레포'}
                    {j.cohort != null ? ` (${j.cohort}기)` : ''}
                  </Badge>
                </Td>
                <Td>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      j.status === 'queued' ? 'bg-base-100 text-base-600' : 'bg-primary-100 text-primary-700'
                    }`}
                  >
                    {j.status}
                  </span>
                </Td>
                <Td className="text-base-700">
                  {j.progress ? `${j.progress.repo} (${j.progress.done}/${j.progress.total})` : '—'}
                </Td>
                <Td className="text-base-700 truncate max-w-[200px]">—</Td>
                <Td>
                  <button
                    onClick={() => cancelJobMutation.mutate(j.id)}
                    disabled={cancelJobMutation.isPending}
                    className="text-xs px-2 py-0.5 rounded bg-danger-50 text-danger-600 hover:bg-danger-100 disabled:opacity-40"
                  >
                    취소
                  </button>
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
      </div>
    </Panel>
  );
}
