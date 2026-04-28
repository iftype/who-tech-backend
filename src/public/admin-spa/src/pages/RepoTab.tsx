import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, pollSyncJob, type SyncJob } from '../lib/api.js';
import { showToast } from '../components/ui/Toast.js';
import { addLog } from '../components/LogPanel.js';
import type { MissionRepo } from '../lib/types.js';

type StatusFilter = '' | 'active' | 'candidate' | 'excluded';
type TabCategoryFilter = '' | 'base' | 'common' | 'precourse' | 'excluded';

type EditableField = 'track' | 'type' | 'tabCategory' | 'level' | 'cohorts' | 'description';
type EditingCell = { repoId: number; field: EditableField } | null;

interface SelectOption {
  value: string;
  label: string;
}

const TRACK_OPTIONS: SelectOption[] = [
  { value: '', label: '공통' },
  { value: 'frontend', label: 'frontend' },
  { value: 'backend', label: 'backend' },
  { value: 'android', label: 'android' },
];

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'individual', label: '개인' },
  { value: 'integration', label: '통합' },
];

const TAB_CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'base', label: '기준' },
  { value: 'common', label: '공통' },
  { value: 'precourse', label: '프리코스' },
  { value: 'excluded', label: '제외' },
];

const STATUS_CYCLE: Record<string, string> = {
  active: 'candidate',
  candidate: 'excluded',
  excluded: 'active',
};

function EditableSelectCell({
  value,
  options,
  onSave,
  onCancel,
  saving,
}: {
  value: string;
  options: SelectOption[];
  onSave: (v: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <select
      ref={ref}
      defaultValue={value}
      disabled={saving}
      onChange={(e) => onSave(e.target.value)}
      onBlur={onCancel}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      className="text-xs border border-blue-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-full disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function EditableTextCell({
  value,
  onSave,
  onCancel,
  saving,
  type = 'text',
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  saving: boolean;
  type?: 'text' | 'number';
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const handleSave = useCallback(() => {
    onSave(localValue);
  }, [localValue, onSave]);

  return (
    <input
      ref={ref}
      type={type}
      value={localValue}
      disabled={saving}
      placeholder={placeholder}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSave();
        }
        if (e.key === 'Escape') {
          onCancel();
        }
      }}
      className="text-xs border border-blue-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-full disabled:opacity-50"
    />
  );
}

function SyncProgress({ job }: { job: SyncJob }) {
  const pct = job.progress?.percent ?? 0;
  const phase = job.progress?.phase ?? job.message ?? '';
  return (
    <div className="mt-1">
      <div className="text-[11px] text-slate-500 mb-0.5">{pct}% — {phase}</div>
      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-teal-700 to-sky-700 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RepoTable({
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
      <span className={`text-xs px-1.5 py-0.5 rounded font-medium border ${colors[c] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
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
        <div className="py-8 text-center text-gray-400 text-sm bg-white/90 backdrop-blur-sm border border-slate-200/60 rounded-2xl">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">{title} <span className="text-gray-400 font-normal">({repos.length}개)</span></h3>
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
                    onToggleSelectAll(repos.map((r) => r.id), allSelected);
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
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Lv</th>
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
                    <a href={r.repoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs font-medium">
                      {r.name}
                    </a>
                    {activeJob && <SyncProgress job={activeJob} />}
                  </td>
                  <td className={cellClass} onClick={() => onStartEdit(r.id, 'track')}>
                    {isEditing(r.id, 'track') ? (
                      <EditableSelectCell value={r.track ?? ''} options={TRACK_OPTIONS} onSave={(v) => onSave(r, 'track', v)} onCancel={onCancel} saving={isSaving(r.id, 'track')} />
                    ) : (
                      <span className="text-xs text-gray-600">{trackLabel(r.track)}</span>
                    )}
                  </td>
                  <td className={cellClass} onClick={() => onStartEdit(r.id, 'type')}>
                    {isEditing(r.id, 'type') ? (
                      <EditableSelectCell value={r.type} options={TYPE_OPTIONS} onSave={(v) => onSave(r, 'type', v)} onCancel={onCancel} saving={isSaving(r.id, 'type')} />
                    ) : (
                      <span className="text-xs text-gray-600">{typeLabel(r.type)}</span>
                    )}
                  </td>
                  <td className={cellClass} onClick={() => onStartEdit(r.id, 'tabCategory')}>
                    {isEditing(r.id, 'tabCategory') ? (
                      <EditableSelectCell value={r.tabCategory} options={TAB_CATEGORY_OPTIONS} onSave={(v) => onSave(r, 'tabCategory', v)} onCancel={onCancel} saving={isSaving(r.id, 'tabCategory')} />
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
                  <td className={cellClass} onClick={() => onStartEdit(r.id, 'level')}>
                    {isEditing(r.id, 'level') ? (
                      <EditableTextCell value={r.level != null ? String(r.level) : ''} type="number" placeholder="—" onSave={(v) => onSave(r, 'level', v)} onCancel={onCancel} saving={isSaving(r.id, 'level')} />
                    ) : (
                      <span className="text-xs text-gray-600">{r.level ?? '—'}</span>
                    )}
                  </td>
                  <td className={cellClass} onClick={() => onStartEdit(r.id, 'cohorts')}>
                    {isEditing(r.id, 'cohorts') ? (
                      <EditableTextCell value={r.cohorts.join(', ')} placeholder="6, 7, 8" onSave={(v) => onSave(r, 'cohorts', v)} onCancel={onCancel} saving={isSaving(r.id, 'cohorts')} />
                    ) : (
                      <span className="text-xs text-gray-500">{r.cohorts.join(', ') || '—'}</span>
                    )}
                  </td>
                  <td className={`${cellClass} max-w-[200px]`} onClick={() => onStartEdit(r.id, 'description')}>
                    {isEditing(r.id, 'description') ? (
                      <EditableTextCell value={r.description ?? ''} placeholder="설명 입력" onSave={(v) => onSave(r, 'description', v)} onCancel={onCancel} saving={isSaving(r.id, 'description')} />
                    ) : (
                      <span className="text-xs text-gray-500 truncate block" title={r.description ?? undefined}>
                        {r.description || '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {r.lastSyncAt ? new Date(r.lastSyncAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
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

export default function RepoTab() {
  const [status, setStatus] = useState<StatusFilter>('');
  const [tabCategory, setTabCategory] = useState<TabCategoryFilter>('');
  const [syncingRepos, setSyncingRepos] = useState<Set<number>>(new Set());
  const [activeJobs, setActiveJobs] = useState<Map<number, SyncJob>>(new Map());
  const stopPollFns = useRef<Map<number, () => void>>(new Map());
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [savingField, setSavingField] = useState<EditingCell>(null);
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<number>>(new Set());
  const [batchTrackValue, setBatchTrackValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => () => stopPollFns.current.forEach((stop) => stop()), []);

  const { data: repos = [], isLoading } = useQuery({
    queryKey: ['repos', status],
    queryFn: () => {
      const params = status ? `?status=${status}` : '';
      return apiFetch<MissionRepo[]>(`/admin/repos${params}`);
    },
  });

  const searchedRepos = searchQuery.trim()
    ? repos.filter((r) => r.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : repos;

  const filteredRepos = tabCategory
    ? searchedRepos.filter((r) => r.tabCategory === tabCategory)
    : searchedRepos;

  const continuousRepos = filteredRepos.filter((r) => r.syncMode === 'continuous');
  const onceRepos = filteredRepos.filter((r) => r.syncMode === 'once');

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiFetch(`/admin/repos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      showToast('수정 완료');
      void queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
    onError: (e) => {
      showToast(e instanceof Error ? e.message : '수정 실패', 'error');
    },
    onSettled: () => {
      setSavingField(null);
      setEditingCell(null);
    },
  });

  const batchTrackMutation = useMutation({
    mutationFn: async ({ ids, track }: { ids: number[]; track: string | null }) => {
      await Promise.all(
        ids.map((id) =>
          apiFetch(`/admin/repos/${id}`, { method: 'PATCH', body: JSON.stringify({ track }) })
        )
      );
    },
    onSuccess: () => {
      showToast('일괄 변경 완료');
      setSelectedRepoIds(new Set());
      setBatchTrackValue('');
      void queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
    onError: (e) => {
      showToast(e instanceof Error ? e.message : '일괄 변경 실패', 'error');
    },
  });

  const resetLastSyncAtMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/admin/repos/${id}`, { method: 'PATCH', body: JSON.stringify({ lastSyncAt: null }) }),
    onSuccess: () => {
      showToast('lastSyncAt 초기화 완료');
      void queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
    onError: (e) => {
      showToast(e instanceof Error ? e.message : '초기화 실패', 'error');
    },
  });

  const handleSave = useCallback(
    (repo: MissionRepo, field: EditableField, rawValue: string) => {
      let value: string | number | number[] | null;

      if (field === 'level') {
        value = rawValue === '' ? null : Number(rawValue);
        if (value !== null && (Number.isNaN(value) || !Number.isInteger(value))) {
          showToast('숫자를 입력하세요', 'error');
          setEditingCell(null);
          return;
        }
      } else if (field === 'cohorts') {
        const trimmed = rawValue.trim();
        if (trimmed === '') {
          value = [];
        } else {
          const parts = trimmed.split(',').map((s) => s.trim());
          const nums = parts.map(Number);
          if (nums.some(Number.isNaN)) {
            showToast('쉼표로 구분된 숫자를 입력하세요', 'error');
            setEditingCell(null);
            return;
          }
          value = nums;
        }
      } else if (field === 'track') {
        value = rawValue === '' ? null : rawValue;
      } else {
        value = rawValue;
      }

      const current =
        field === 'cohorts'
          ? JSON.stringify((repo[field] as number[]).slice().sort())
          : String(repo[field] ?? '');
      const next =
        field === 'cohorts'
          ? JSON.stringify((value as number[]).slice().sort())
          : String(value ?? '');

      if (current === next) {
        setEditingCell(null);
        return;
      }

      setSavingField({ repoId: repo.id, field });
      updateMutation.mutate({ id: repo.id, data: { [field]: value } });
    },
    [updateMutation],
  );

  const handleCancel = useCallback(() => {
    setEditingCell(null);
  }, []);

  const startEdit = useCallback((repoId: number, field: EditableField) => {
    setEditingCell({ repoId, field });
  }, []);

  const discoverMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ discovered: number; created: number; updated: number }>('/admin/repos/discover', { method: 'POST' }),
    onSuccess: (result) => {
      showToast(`탐색 완료 — ${result.discovered}개 발견, ${result.created}개 생성, ${result.updated}개 갱신`);
      void queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '탐색 실패', 'error'),
  });

  const continuousSyncMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ totalSynced: number; reposSynced: number }>('/admin/sync/continuous', { method: 'POST' }),
    onSuccess: (result) => {
      showToast(`연속 싱크 완료 — ${result.totalSynced}건, ${result.reposSynced}개 레포`);
      void queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '연속 싱크 실패', 'error'),
  });

  const syncRepo = async (repo: MissionRepo) => {
    setSyncingRepos((prev) => new Set(prev).add(repo.id));
    addLog('run', `[${repo.name}] 싱크 시작`);
    try {
      const job = await apiFetch<SyncJob>(`/admin/repos/${repo.id}/sync`, { method: 'POST' });
      setActiveJobs((prev) => new Map(prev).set(repo.id, job));

      const stop = pollSyncJob(job.id, (updated) => {
        setActiveJobs((prev) => new Map(prev).set(repo.id, updated));
        if (updated.progress) {
          addLog('run', `[${repo.name}] ${updated.progress.percent}% — ${updated.progress.phase}`);
        }
        if (updated.status === 'completed') {
          addLog('ok', `[${repo.name}] 싱크 완료 (${updated.result?.synced ?? 0}건)`);
          showToast(`${repo.name} 싱크 완료`);
          setSyncingRepos((prev) => { const s = new Set(prev); s.delete(repo.id); return s; });
          setActiveJobs((prev) => { const m = new Map(prev); m.delete(repo.id); return m; });
          stopPollFns.current.delete(repo.id);
          void queryClient.invalidateQueries({ queryKey: ['repos'] });
        } else if (updated.status === 'failed') {
          addLog('err', `[${repo.name}] 싱크 실패: ${updated.error ?? updated.message}`);
          showToast(`${repo.name} 싱크 실패`, 'error');
          setSyncingRepos((prev) => { const s = new Set(prev); s.delete(repo.id); return s; });
          setActiveJobs((prev) => { const m = new Map(prev); m.delete(repo.id); return m; });
          stopPollFns.current.delete(repo.id);
        }
      });
      stopPollFns.current.set(repo.id, stop);
    } catch (e) {
      addLog('err', `[${repo.name}] 싱크 요청 실패`);
      showToast(e instanceof Error ? e.message : '싱크 실패', 'error');
      setSyncingRepos((prev) => { const s = new Set(prev); s.delete(repo.id); return s; });
    }
  };

  const syncAllBase = async () => {
    const targets = repos.filter((r) => r.tabCategory === 'base' && r.status === 'active');
    if (targets.length === 0) { showToast('대상 레포가 없습니다', 'error'); return; }
    if (!confirm(`base 카테고리의 active 레포 ${targets.length}개를 순차적으로 싱크합니다. 계속하시겠습니까?`)) return;
    addLog('info', `[Batch] base 전체 싱크 시작 — ${targets.length}개`);
    for (const repo of targets) {
      await syncRepo(repo);
    }
    addLog('ok', `[Batch] base 전체 싱크 완료 — ${targets.length}개`);
    showToast('base 전체 싱크 완료');
  };

  const toggleStatus = async (repo: MissionRepo) => {
    const newStatus = STATUS_CYCLE[repo.status] ?? 'active';
    try {
      await apiFetch(`/admin/repos/${repo.id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      void queryClient.invalidateQueries({ queryKey: ['repos'] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : '수정 실패', 'error');
    }
  };

  const toggleSyncMode = async (repo: MissionRepo) => {
    const newMode = repo.syncMode === 'continuous' ? 'once' : 'continuous';
    try {
      await apiFetch(`/admin/repos/${repo.id}`, { method: 'PATCH', body: JSON.stringify({ syncMode: newMode }) });
      void queryClient.invalidateQueries({ queryKey: ['repos'] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : '수정 실패', 'error');
    }
  };

  const deleteRepo = async (repo: MissionRepo) => {
    if (!confirm(`${repo.name} 삭제하시겠습니까? 관련 submission도 삭제됩니다.`)) return;
    setDeleting(repo.id);
    try {
      await apiFetch(`/admin/repos/${repo.id}`, { method: 'DELETE' });
      showToast('삭제 완료');
      void queryClient.invalidateQueries({ queryKey: ['repos'] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : '삭제 실패', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const toggleSelect = useCallback((repoId: number) => {
    setSelectedRepoIds((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((repoIds: number[], allSelected: boolean) => {
    if (allSelected) {
      setSelectedRepoIds((prev) => {
        const next = new Set(prev);
        repoIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedRepoIds((prev) => {
        const next = new Set(prev);
        repoIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, []);

  const handleBatchTrackUpdate = useCallback(() => {
    const ids = Array.from(selectedRepoIds);
    if (ids.length === 0) {
      showToast('선택된 레포가 없습니다', 'error');
      return;
    }
    const track = batchTrackValue === '' ? null : batchTrackValue;
    batchTrackMutation.mutate({ ids, track });
  }, [selectedRepoIds, batchTrackValue, batchTrackMutation]);

  return (
    <div className="space-y-6">

      <div className="bg-white/90 backdrop-blur-sm border border-slate-200/60 rounded-2xl px-4 py-3 text-xs text-slate-600">
        <div className="font-semibold text-slate-700 mb-1.5">상태 설명</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span><span className="inline-block px-1.5 py-0.5 rounded font-medium border bg-green-100 text-green-700 border-green-200 mr-1">active</span> 전체 싱크 대상에 포함됨</span>
          <span><span className="inline-block px-1.5 py-0.5 rounded font-medium border bg-yellow-100 text-yellow-700 border-yellow-200 mr-1">candidate</span> 후보 상태, 수동으로 active로 승인 필요</span>
          <span><span className="inline-block px-1.5 py-0.5 rounded font-medium border bg-red-100 text-red-700 border-red-200 mr-1">excluded</span> 싱크 대상에서 제외됨</span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {(['', 'active', 'candidate', 'excluded'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                status === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {s || '전체 상태'}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {(['', 'base', 'common', 'precourse', 'excluded'] as TabCategoryFilter[]).map((c) => (
            <button
              key={c}
              onClick={() => setTabCategory(c)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                tabCategory === c ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {c || '전체 카테고리'}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="레포 검색..."
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <span className="text-xs text-gray-400">{filteredRepos.length}개</span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => void continuousSyncMutation.mutate()}
            disabled={continuousSyncMutation.isPending || syncingRepos.size > 0}
            className="bg-purple-600 text-white rounded-xl px-3 py-1.5 text-sm hover:bg-purple-700 disabled:opacity-40"
          >
            {continuousSyncMutation.isPending ? '연속 싱크 중...' : '연속 싱크'}
          </button>
          <button
            onClick={() => void syncAllBase()}
            disabled={syncingRepos.size > 0}
            className="bg-gradient-to-br from-teal-700 to-sky-700 text-white rounded-xl px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-40"
          >
            Base 전체 싱크
          </button>
          <button
            onClick={() => discoverMutation.mutate()}
            disabled={discoverMutation.isPending}
            className="bg-gradient-to-br from-teal-700 to-sky-700 text-white rounded-xl px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-40"
          >
            {discoverMutation.isPending ? '탐색 중...' : '레포 탐색'}
          </button>
        </div>
      </div>

      {selectedRepoIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium text-blue-700">{selectedRepoIds.size}개 선택됨</span>
          <select
            value={batchTrackValue}
            onChange={(e) => setBatchTrackValue(e.target.value)}
            className="text-sm border border-blue-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {TRACK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleBatchTrackUpdate}
            disabled={batchTrackMutation.isPending}
            className="text-sm px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {batchTrackMutation.isPending ? '변경 중...' : '일괄 변경'}
          </button>
          <button
            onClick={() => setSelectedRepoIds(new Set())}
            className="text-sm px-3 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            선택 해제
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">로딩 중...</div>
      ) : (
        <>
          <RepoTable
            repos={continuousRepos}
            title="자동수집 레포"
            emptyMessage="자동수집 레포가 없습니다"
            syncingRepos={syncingRepos}
            activeJobs={activeJobs}
            deleting={deleting}
            editingCell={editingCell}
            savingField={savingField}
            selectedRepoIds={selectedRepoIds}
            onStartEdit={startEdit}
            onSave={handleSave}
            onCancel={handleCancel}
            onSync={syncRepo}
            onToggleStatus={toggleStatus}
            onToggleSyncMode={toggleSyncMode}
            onDelete={deleteRepo}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onResetLastSyncAt={(id) => resetLastSyncAtMutation.mutate(id)}
          />
          <RepoTable
            repos={onceRepos}
            title="1회수집 레포"
            emptyMessage="1회수집 레포가 없습니다"
            syncingRepos={syncingRepos}
            activeJobs={activeJobs}
            deleting={deleting}
            editingCell={editingCell}
            savingField={savingField}
            selectedRepoIds={selectedRepoIds}
            onStartEdit={startEdit}
            onSave={handleSave}
            onCancel={handleCancel}
            onSync={syncRepo}
            onToggleStatus={toggleStatus}
            onToggleSyncMode={toggleSyncMode}
            onDelete={deleteRepo}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onResetLastSyncAt={(id) => resetLastSyncAtMutation.mutate(id)}
          />
        </>
      )}
    </div>
  );
}
