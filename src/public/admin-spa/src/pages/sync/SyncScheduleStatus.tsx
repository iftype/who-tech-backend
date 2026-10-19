import type { AdminStatus, MissionRepo, Workspace } from '../../lib/types.js';
import { Table, TBody, THead, Td, Th } from '../../components/ui/Table.js';
import { Panel, SectionTitle } from '../../components/ui/Section.js';

export function SyncScheduleStatus({
  workspace,
  status,
  remainingTime,
  continuousRepos,
}: {
  workspace: Workspace | undefined;
  status: AdminStatus | undefined;
  remainingTime: string;
  continuousRepos: MissionRepo[];
}) {
  return (
    <Panel variant="card" className="space-y-3">
      <SectionTitle as="h3" size="sm">
        싱크 스케줄 상태
      </SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <Panel>
          <div className="flex items-center justify-between">
            <span className="text-xs text-base-500">블로그 RSS 자동 싱크</span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                workspace?.blogSyncEnabled ? 'bg-success-100 text-success-700' : 'bg-base-100 text-base-500'
              }`}
            >
              {workspace?.blogSyncEnabled ? '활성' : '비활성'}
            </span>
          </div>
          {workspace?.blogSyncEnabled && (
            <p className="text-[10px] text-base-400 mt-1">다음 싱크까지 {remainingTime}</p>
          )}
        </Panel>
        <Panel>
          <div className="flex items-center justify-between">
            <span className="text-xs text-base-500">프로필 자동 새로고침</span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                workspace?.profileRefreshEnabled ? 'bg-success-100 text-success-700' : 'bg-base-100 text-base-500'
              }`}
            >
              {workspace?.profileRefreshEnabled ? '활성' : '비활성'}
            </span>
          </div>
          {workspace?.profileRefreshEnabled && (
            <p className="text-[10px] text-base-400 mt-1">다음 새로고침까지 {remainingTime}</p>
          )}
          {status?.lastProfileRefreshAt && (
            <p className="text-[10px] text-base-400 mt-1">
              마지막:{' '}
              {new Date(status.lastProfileRefreshAt).toLocaleString('ko-KR', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </Panel>
        <Panel>
          <div className="flex items-center justify-between">
            <span className="text-xs text-base-500">연속 싱크 대상 레포</span>
            <span className="text-xs font-semibold text-base-900">{continuousRepos.length}개</span>
          </div>
        </Panel>
      </div>
      {continuousRepos.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded border border-base-200">
          <Table size="xs">
            <THead>
              <tr>
                <Th density="tight" size="inherit">
                  레포
                </Th>
                <Th density="tight" size="inherit">
                  트랙
                </Th>
              </tr>
            </THead>
            <TBody>
              {continuousRepos.map((r) => (
                <tr key={r.id} className="hover:bg-base-50">
                  <Td density="tight" className="font-medium text-base-700 truncate max-w-[200px]">
                    {r.name}
                  </Td>
                  <Td density="tight" className="text-base-500">
                    {r.track ?? '—'}
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}
