import type { SyncJob } from '../../lib/api.js';
import type { MissionRepo } from '../../lib/types.js';
import { EditableSelectCell, EditableTextCell, SyncProgress } from './RepoCells.js';
import {
  TAB_CATEGORY_OPTIONS,
  TRACK_OPTIONS,
  TYPE_OPTIONS,
  type EditableField,
  type EditingCell,
} from './repo-options.js';

export function RepoTable({
  repos,
  title,
  emptyMessage,
  syncingRepos,
  activeJobs,
  deleting,
  editingCell,
  savingField,
  selectedRepoIds,
  onStartEdit,
  onSave,
  onCancel,
  onSync,
  onToggleStatus,
  onToggleSyncMode,
  onDelete,
  onToggleSelect,
  onToggleSelectAll,
  onResetLastSyncAt,
}: {
  repos: MissionRepo[];
  title: string;
  emptyMessage: string;
  syncingRepos: Set<number>;
  activeJobs: Map<number, SyncJob>;
  deleting: number | null;
  editingCell: EditingCell;
  savingField: EditingCell;
  selectedRepoIds: Set<number>;
  onStartEdit: (repoId: number, field: EditableField) => void;
  onSave: (repo: MissionRepo, field: EditableField, value: string) => void;
  onCancel: () => void;
  onSync: (repo: MissionRepo) => void;
  onToggleStatus: (repo: MissionRepo) => void;
  onToggleSyncMode: (repo: MissionRepo) => void;
  onDelete: (repo: MissionRepo) => void;
  onToggleSelect: (repoId: number) => void;
  onToggleSelectAll: (repoIds: number[], allSelected: boolean) => void;
  onResetLastSyncAt: (repoId: number) => void;
}) {
  const isEditing = (repoId: number, field: EditableField) =>
    editingCell?.repoId === repoId && editingCell?.field === field;
  const isSaving = (repoId: number, field: EditableField) =>
    savingField?.repoId === repoId && savingField?.field === field;

  const statusBadge = (s: string, repo: MissionRepo) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700 border-green-200',
      candidate: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      excluded: 'bg-red-100 text-red-700 border-red-200',
    };
    return (
      <button
        onClick={() => onToggleStatus(repo)}
        title="클릭하여 상태 전환 (active → candidate → excluded → active)"
        className={`text-xs px-1.5 py-0.5 rounded font-medium border cursor-pointer hover:scale-105 transition-transform ${colors[s] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}
      >
        {s}
      </button>
    );
  };

  const tabCategoryBadge = (c: string) => {
    const labels: Record<string, string> = { base: '기준', common: '공통', precourse: '프리코스', excluded: '제외' };
    const colors: Record<string, string> = {
      base: 'bg-blue-50 text-blue-700 border-blue-200',
      common: 'bg-purple-50 text-purple-700 border-purple-200',
      precourse: 'bg-orange-50 text-orange-700 border-orange-200',
      excluded: 'bg-gray-100 text-gray-500 border-gray-200',
    };
    return (
      <span
        className={`text-xs px-1.5 py-0.5 rounded font-medium border ${colors[c] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}
      >
        {labels[c] ?? c}
      </span>
    );
  };

  const trackLabel = (t: string | null) => (!t ? '공통' : t);
  const typeLabel = (t: string) => (t === 'integration' ? '통합' : '개인');
  const cellClass = 'px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors duration-100';

  if (repos.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <div className="py-8 text-center text-gray-400 text-sm bg-white/90 backdrop-blur-sm border border-slate-200/60 rounded-2xl">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">
        {title} <span className="text-gray-400 font-normal">({repos.length}개)</span>
      </h3>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/60">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={repos.length > 0 && repos.every((r) => selectedRepoIds.has(r.id))}
                  onChange={() => {
                    const allSelected = repos.every((r) => selectedRepoIds.has(r.id));
                    onToggleSelectAll(
                      repos.map((r) => r.id),
                      allSelected,
                    );
                  }}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">레포</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">트랙</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">타입</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">카테고리</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">상태</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">모드</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">기수</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">설명</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">마지막싱크</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">제출</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {repos.map((r) => {
              const isSyncing = syncingRepos.has(r.id);
              const activeJob = activeJobs.get(r.id);
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedRepoIds.has(r.id)}
                      onChange={() => onToggleSelect(r.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={r.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      {r.name}
                    </a>
                    {activeJob && <SyncProgress job={activeJob} />}
                  </td>
                  <td className={cellClass} onClick={() => onStartEdit(r.id, 'track')}>
                    {isEditing(r.id, 'track') ? (
                      <EditableSelectCell
                        value={r.track ?? ''}
                        options={TRACK_OPTIONS}
                        onSave={(v) => onSave(r, 'track', v)}
                        onCancel={onCancel}
                        saving={isSaving(r.id, 'track')}
                      />
                    ) : (
                      <span className="text-xs text-gray-600">{trackLabel(r.track)}</span>
                    )}
                  </td>
                  <td className={cellClass} onClick={() => onStartEdit(r.id, 'type')}>
                    {isEditing(r.id, 'type') ? (
                      <EditableSelectCell
                        value={r.type}
                        options={TYPE_OPTIONS}
                        onSave={(v) => onSave(r, 'type', v)}
                        onCancel={onCancel}
                        saving={isSaving(r.id, 'type')}
                      />
                    ) : (
                      <span className="text-xs text-gray-600">{typeLabel(r.type)}</span>
                    )}
                  </td>
                  <td className={cellClass} onClick={() => onStartEdit(r.id, 'tabCategory')}>
                    {isEditing(r.id, 'tabCategory') ? (
                      <EditableSelectCell
                        value={r.tabCategory}
                        options={TAB_CATEGORY_OPTIONS}
                        onSave={(v) => onSave(r, 'tabCategory', v)}
                        onCancel={onCancel}
                        saving={isSaving(r.id, 'tabCategory')}
                      />
                    ) : (
                      tabCategoryBadge(r.tabCategory)
                    )}
                  </td>
                  <td className="px-3 py-2">{statusBadge(r.status, r)}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => void onToggleSyncMode(r)}
                      title="클릭하여 전환"
                      className={`text-xs px-1.5 py-0.5 rounded font-medium border ${
                        r.syncMode === 'continuous'
                          ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {r.syncMode === 'continuous' ? '연속' : '1회'}
                    </button>
                  </td>
                  <td className={cellClass} onClick={() => onStartEdit(r.id, 'cohorts')}>
                    {isEditing(r.id, 'cohorts') ? (
                      <EditableTextCell
                        value={r.cohorts.join(', ')}
                        placeholder="6, 7, 8"
                        onSave={(v) => onSave(r, 'cohorts', v)}
                        onCancel={onCancel}
                        saving={isSaving(r.id, 'cohorts')}
                      />
                    ) : (
                      <span className="text-xs text-gray-500">{r.cohorts.join(', ') || '—'}</span>
                    )}
                  </td>
                  <td className={`${cellClass} max-w-[200px]`} onClick={() => onStartEdit(r.id, 'description')}>
                    {isEditing(r.id, 'description') ? (
                      <EditableTextCell
                        value={r.description ?? ''}
                        placeholder="설명 입력"
                        onSave={(v) => onSave(r, 'description', v)}
                        onCancel={onCancel}
                        saving={isSaving(r.id, 'description')}
                      />
                    ) : (
                      <span className="text-xs text-gray-500 truncate block" title={r.description ?? undefined}>
                        {r.description || '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {r.lastSyncAt
                      ? new Date(r.lastSyncAt).toLocaleString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r._count.submissions}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 items-center">
                      <button
                        onClick={() => void onSync(r)}
                        disabled={isSyncing}
                        className="text-[10px] px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                        title="싱크"
                      >
                        {isSyncing ? '...' : '싱크'}
                      </button>
                      <button
                        onClick={() => void onResetLastSyncAt(r.id)}
                        className="text-[10px] px-2 py-1 rounded border border-amber-300 text-amber-600 hover:bg-amber-50"
                        title="lastSyncAt 초기화 (전체 재싱크)"
                      >
                        초기화
                      </button>
                      <button
                        onClick={() => void onDelete(r)}
                        disabled={deleting === r.id}
                        className="text-[10px] px-2 py-1 rounded border border-red-300 text-red-500 hover:bg-red-50 disabled:opacity-40"
                        title="삭제"
                      >
                        삭제
                      </button>
                    </div>
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
