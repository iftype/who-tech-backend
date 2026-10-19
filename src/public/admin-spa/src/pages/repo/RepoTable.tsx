import type { SyncJob } from '../../lib/types.js';
import type { MissionRepo } from '../../lib/types.js';
import { EditableSelectCell, EditableTextCell, SyncProgress } from './RepoCells.js';
import {
  TAB_CATEGORY_OPTIONS,
  TRACK_OPTIONS,
  TYPE_OPTIONS,
  type EditableField,
  type EditingCell,
} from './repo-options.js';
import { Table, TBody, THead, Td, Th } from '../../components/ui/Table.js';

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
      active: 'bg-success-100 text-success-700 border-success-200',
      candidate: 'bg-highlight-100 text-highlight-700 border-highlight-200',
      excluded: 'bg-danger-100 text-danger-700 border-danger-200',
    };
    return (
      <button
        onClick={() => onToggleStatus(repo)}
        title="클릭하여 상태 전환 (active → candidate → excluded → active)"
        className={`text-xs px-1.5 py-0.5 rounded font-medium border cursor-pointer hover:scale-105 transition-transform ${colors[s] ?? 'bg-base-100 text-base-500 border-base-200'}`}
      >
        {s}
      </button>
    );
  };

  const tabCategoryBadge = (c: string) => {
    const labels: Record<string, string> = { base: '기준', common: '공통', precourse: '프리코스', excluded: '제외' };
    const colors: Record<string, string> = {
      base: 'bg-primary-50 text-primary-700 border-primary-200',
      common: 'bg-accent-50 text-accent-700 border-accent-200',
      precourse: 'bg-caution-50 text-caution-700 border-caution-200',
      excluded: 'bg-base-100 text-base-500 border-base-200',
    };
    return (
      <span
        className={`text-xs px-1.5 py-0.5 rounded font-medium border ${colors[c] ?? 'bg-base-100 text-base-500 border-base-200'}`}
      >
        {labels[c] ?? c}
      </span>
    );
  };

  const trackLabel = (t: string | null) => (!t ? '공통' : t);
  const typeLabel = (t: string) => (t === 'integration' ? '통합' : '개인');
  const cellClass = 'px-3 py-2 cursor-pointer hover:bg-primary-50 transition-colors duration-100';

  if (repos.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-base-700">{title}</h3>
        <div className="py-8 text-center text-base-400 text-sm bg-white/90 backdrop-blur-sm border border-console-200/60 rounded-2xl">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-base-700">
        {title} <span className="text-base-400 font-normal">({repos.length}개)</span>
      </h3>
      <div className="overflow-x-auto rounded-2xl border border-console-200/60">
        <Table>
          <THead>
            <tr>
              <Th className="w-8">
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
                  className="rounded border-base-300"
                />
              </Th>
              <Th>레포</Th>
              <Th>트랙</Th>
              <Th>타입</Th>
              <Th>카테고리</Th>
              <Th>상태</Th>
              <Th>모드</Th>
              <Th>기수</Th>
              <Th>설명</Th>
              <Th>마지막싱크</Th>
              <Th>제출</Th>
              <Th>작업</Th>
            </tr>
          </THead>
          <TBody>
            {repos.map((r) => {
              const isSyncing = syncingRepos.has(r.id);
              const activeJob = activeJobs.get(r.id);
              return (
                <tr key={r.id} className="hover:bg-base-50">
                  <Td>
                    <input
                      type="checkbox"
                      checked={selectedRepoIds.has(r.id)}
                      onChange={() => onToggleSelect(r.id)}
                      className="rounded border-base-300"
                    />
                  </Td>
                  <Td>
                    <a
                      href={r.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline text-xs font-medium"
                    >
                      {r.name}
                    </a>
                    {activeJob && <SyncProgress job={activeJob} />}
                  </Td>
                  <Td density="none" className={cellClass} onClick={() => onStartEdit(r.id, 'track')}>
                    {isEditing(r.id, 'track') ? (
                      <EditableSelectCell
                        value={r.track ?? ''}
                        options={TRACK_OPTIONS}
                        onSave={(v) => onSave(r, 'track', v)}
                        onCancel={onCancel}
                        saving={isSaving(r.id, 'track')}
                      />
                    ) : (
                      <span className="text-xs text-base-600">{trackLabel(r.track)}</span>
                    )}
                  </Td>
                  <Td density="none" className={cellClass} onClick={() => onStartEdit(r.id, 'type')}>
                    {isEditing(r.id, 'type') ? (
                      <EditableSelectCell
                        value={r.type}
                        options={TYPE_OPTIONS}
                        onSave={(v) => onSave(r, 'type', v)}
                        onCancel={onCancel}
                        saving={isSaving(r.id, 'type')}
                      />
                    ) : (
                      <span className="text-xs text-base-600">{typeLabel(r.type)}</span>
                    )}
                  </Td>
                  <Td density="none" className={cellClass} onClick={() => onStartEdit(r.id, 'tabCategory')}>
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
                  </Td>
                  <Td>{statusBadge(r.status, r)}</Td>
                  <Td>
                    <button
                      onClick={() => void onToggleSyncMode(r)}
                      title="클릭하여 전환"
                      className={`text-xs px-1.5 py-0.5 rounded font-medium border ${
                        r.syncMode === 'continuous'
                          ? 'bg-accent-50 text-accent-700 border-accent-200 hover:bg-accent-100'
                          : 'bg-base-50 text-base-500 border-base-200 hover:bg-base-100'
                      }`}
                    >
                      {r.syncMode === 'continuous' ? '연속' : '1회'}
                    </button>
                  </Td>
                  <Td density="none" className={cellClass} onClick={() => onStartEdit(r.id, 'cohorts')}>
                    {isEditing(r.id, 'cohorts') ? (
                      <EditableTextCell
                        value={r.cohorts.join(', ')}
                        placeholder="6, 7, 8"
                        onSave={(v) => onSave(r, 'cohorts', v)}
                        onCancel={onCancel}
                        saving={isSaving(r.id, 'cohorts')}
                      />
                    ) : (
                      <span className="text-xs text-base-500">{r.cohorts.join(', ') || '—'}</span>
                    )}
                  </Td>
                  <Td
                    density="none"
                    className={`${cellClass} max-w-[200px]`}
                    onClick={() => onStartEdit(r.id, 'description')}
                  >
                    {isEditing(r.id, 'description') ? (
                      <EditableTextCell
                        value={r.description ?? ''}
                        placeholder="설명 입력"
                        onSave={(v) => onSave(r, 'description', v)}
                        onCancel={onCancel}
                        saving={isSaving(r.id, 'description')}
                      />
                    ) : (
                      <span className="text-xs text-base-500 truncate block" title={r.description ?? undefined}>
                        {r.description || '—'}
                      </span>
                    )}
                  </Td>
                  <Td className="text-xs text-base-500 whitespace-nowrap">
                    {r.lastSyncAt
                      ? new Date(r.lastSyncAt).toLocaleString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })
                      : '—'}
                  </Td>
                  <Td className="text-xs text-base-600">{r._count.submissions}</Td>
                  <Td>
                    <div className="flex gap-1 items-center">
                      <button
                        onClick={() => void onSync(r)}
                        disabled={isSyncing}
                        className="text-[10px] px-2 py-1 rounded border border-primary-300 text-primary-600 hover:bg-primary-50 disabled:opacity-40"
                        title="싱크"
                      >
                        {isSyncing ? '...' : '싱크'}
                      </button>
                      <button
                        onClick={() => void onResetLastSyncAt(r.id)}
                        className="text-[10px] px-2 py-1 rounded border border-warning-300 text-warning-600 hover:bg-warning-50"
                        title="lastSyncAt 초기화 (전체 재싱크)"
                      >
                        초기화
                      </button>
                      <button
                        onClick={() => void onDelete(r)}
                        disabled={deleting === r.id}
                        className="text-[10px] px-2 py-1 rounded border border-danger-300 text-danger-500 hover:bg-danger-50 disabled:opacity-40"
                        title="삭제"
                      >
                        삭제
                      </button>
                    </div>
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
