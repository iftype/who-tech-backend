import type { AdminStatus, MissionRepo, Workspace } from '../../lib/types.js';

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
    <div className="bg-white border border-gray-200 rounded p-4 space-y-3">
      <h3 className="text-xs font-semibold text-gray-600">싱크 스케줄 상태</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 border border-gray-200 rounded p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">블로그 RSS 자동 싱크</span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                workspace?.blogSyncEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {workspace?.blogSyncEnabled ? '활성' : '비활성'}
            </span>
          </div>
          {workspace?.blogSyncEnabled && (
            <p className="text-[10px] text-gray-400 mt-1">다음 싱크까지 {remainingTime}</p>
          )}
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">프로필 자동 새로고침</span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                workspace?.profileRefreshEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {workspace?.profileRefreshEnabled ? '활성' : '비활성'}
            </span>
          </div>
          {workspace?.profileRefreshEnabled && (
            <p className="text-[10px] text-gray-400 mt-1">다음 새로고침까지 {remainingTime}</p>
          )}
          {status?.lastProfileRefreshAt && (
            <p className="text-[10px] text-gray-400 mt-1">
              마지막:{' '}
              {new Date(status.lastProfileRefreshAt).toLocaleString('ko-KR', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">연속 싱크 대상 레포</span>
            <span className="text-xs font-semibold text-gray-900">{continuousRepos.length}개</span>
          </div>
        </div>
      </div>
      {continuousRepos.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left font-medium text-gray-500 px-2 py-1">레포</th>
                <th className="text-left font-medium text-gray-500 px-2 py-1">트랙</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {continuousRepos.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1 font-medium text-gray-700 truncate max-w-[200px]">{r.name}</td>
                  <td className="px-2 py-1 text-gray-500">{r.track ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
