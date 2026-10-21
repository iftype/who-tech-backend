import type { SyncQueueJob } from '../../lib/types.js';
import type { RecentSyncJob } from '../../lib/types.js';
import { JOB_TYPE_LABEL } from './job-labels.js';
import { Table, TableFrame, TBody, Td, Th, THead, Tr } from '../../components/ui/Table.js';
import { Badge, type BadgeTone } from '../../components/ui/Badge.js';
import { Panel, SectionTitle } from '../../components/ui/Section.js';

const JOB_STATUS_TONE: Record<string, BadgeTone> = { completed: 'success', failed: 'danger', running: 'primary' };

export function RecentJobsTable({ jobs }: { jobs: (SyncQueueJob | RecentSyncJob)[] }) {
  return (
    <Panel variant="card">
      <SectionTitle as="h3" size="sm" className="mb-3">
        최근 싱크 작업 ({jobs.length})
      </SectionTitle>
      <TableFrame className="max-h-64 overflow-y-auto">
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
              // 레포·블로그 작업에는 type이 없다 (블로그 작업은 repoName도 없어 그것으로는 가를 수 없음)
              const isQueueJob = 'type' in j;
              const queueJob = j as SyncQueueJob;
              const repoJob = j as RecentSyncJob;
              return (
                <Tr key={j.id}>
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
                        {JOB_TYPE_LABEL[queueJob.type]}
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
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </TableFrame>
    </Panel>
  );
}
