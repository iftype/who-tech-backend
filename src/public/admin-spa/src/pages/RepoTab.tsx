import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pollSyncJob } from '../lib/api.js';
import type { SyncJob } from '../lib/types.js';
import { showToast } from '../components/ui/Toast.js';
import { addLog } from '../components/LogPanel.js';
import type { MissionRepo } from '../lib/types.js';
import { RepoTable } from './repo/RepoTable.js';
import {
  STATUS_CYCLE,
  TRACK_OPTIONS,
  type EditableField,
  type EditingCell,
  type StatusFilter,
  type TabCategoryFilter,
} from './repo/repo-options.js';
import { adminApi } from '../lib/admin-api.js';
import { queryKeys } from '../lib/query-keys.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/ui/Section.js';

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
    queryKey: queryKeys.repos.byStatus(status),
    queryFn: () => {
      const params = status ? `?status=${status}` : '';
      return adminApi.repos.list(params);
    },
  });

  const searchedRepos = searchQuery.trim()
    ? repos.filter((r) => r.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : repos;

  const filteredRepos = tabCategory ? searchedRepos.filter((r) => r.tabCategory === tabCategory) : searchedRepos;

  const continuousRepos = filteredRepos.filter((r) => r.syncMode === 'continuous');
  const onceRepos = filteredRepos.filter((r) => r.syncMode === 'once');

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => adminApi.repos.update(id, data),
    onSuccess: () => {
      showToast('수정 완료');
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos.all() });
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
      await Promise.all(ids.map((id) => adminApi.repos.update(id, { track })));
    },
    onSuccess: () => {
      showToast('일괄 변경 완료');
      setSelectedRepoIds(new Set());
      setBatchTrackValue('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos.all() });
    },
    onError: (e) => {
      showToast(e instanceof Error ? e.message : '일괄 변경 실패', 'error');
    },
  });

  const resetLastSyncAtMutation = useMutation({
    mutationFn: (id: number) => adminApi.repos.update(id, { lastSyncAt: null }),
    onSuccess: () => {
      showToast('lastSyncAt 초기화 완료');
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos.all() });
    },
    onError: (e) => {
      showToast(e instanceof Error ? e.message : '초기화 실패', 'error');
    },
  });

  const handleSave = useCallback(
    (repo: MissionRepo, field: EditableField, rawValue: string) => {
      let value: string | number | number[] | null;

      if (field === 'cohorts') {
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
        field === 'cohorts' ? JSON.stringify((repo[field] as number[]).slice().sort()) : String(repo[field] ?? '');
      const next = field === 'cohorts' ? JSON.stringify((value as number[]).slice().sort()) : String(value ?? '');

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
    mutationFn: () => adminApi.repos.discover(),
    onSuccess: (result) => {
      showToast(`탐색 완료 — ${result.discovered}개 발견, ${result.created}개 생성, ${result.updated}개 갱신`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos.all() });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '탐색 실패', 'error'),
  });

  const continuousSyncMutation = useMutation({
    mutationFn: () => adminApi.sync.continuous(),
    onSuccess: (result) => {
      showToast(`연속 싱크 완료 — ${result.totalSynced}건, ${result.reposSynced}개 레포`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos.all() });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '연속 싱크 실패', 'error'),
  });

  const syncRepo = async (repo: MissionRepo) => {
    setSyncingRepos((prev) => new Set(prev).add(repo.id));
    addLog('run', `[${repo.name}] 싱크 시작`);
    try {
      const job = await adminApi.repos.sync(repo.id);
      setActiveJobs((prev) => new Map(prev).set(repo.id, job));

      const stop = pollSyncJob(job.id, (updated) => {
        setActiveJobs((prev) => new Map(prev).set(repo.id, updated));
        if (updated.progress) {
          addLog('run', `[${repo.name}] ${updated.progress.percent}% — ${updated.progress.phase}`);
        }
        if (updated.status === 'completed') {
          addLog('ok', `[${repo.name}] 싱크 완료 (${updated.result?.synced ?? 0}건)`);
          showToast(`${repo.name} 싱크 완료`);
          setSyncingRepos((prev) => {
            const s = new Set(prev);
            s.delete(repo.id);
            return s;
          });
          setActiveJobs((prev) => {
            const m = new Map(prev);
            m.delete(repo.id);
            return m;
          });
          stopPollFns.current.delete(repo.id);
          void queryClient.invalidateQueries({ queryKey: queryKeys.repos.all() });
        } else if (updated.status === 'failed') {
          addLog('err', `[${repo.name}] 싱크 실패: ${updated.error ?? updated.message}`);
          showToast(`${repo.name} 싱크 실패`, 'error');
          setSyncingRepos((prev) => {
            const s = new Set(prev);
            s.delete(repo.id);
            return s;
          });
          setActiveJobs((prev) => {
            const m = new Map(prev);
            m.delete(repo.id);
            return m;
          });
          stopPollFns.current.delete(repo.id);
        }
      });
      stopPollFns.current.set(repo.id, stop);
    } catch (e) {
      addLog('err', `[${repo.name}] 싱크 요청 실패`);
      showToast(e instanceof Error ? e.message : '싱크 실패', 'error');
      setSyncingRepos((prev) => {
        const s = new Set(prev);
        s.delete(repo.id);
        return s;
      });
    }
  };

  const syncAllBase = async () => {
    const targets = repos.filter((r) => r.tabCategory === 'base' && r.status === 'active');
    if (targets.length === 0) {
      showToast('대상 레포가 없습니다', 'error');
      return;
    }
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
      await adminApi.repos.update(repo.id, { status: newStatus });
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos.all() });
    } catch (e) {
      showToast(e instanceof Error ? e.message : '수정 실패', 'error');
    }
  };

  const toggleSyncMode = async (repo: MissionRepo) => {
    const newMode = repo.syncMode === 'continuous' ? 'once' : 'continuous';
    try {
      await adminApi.repos.update(repo.id, { syncMode: newMode });
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos.all() });
    } catch (e) {
      showToast(e instanceof Error ? e.message : '수정 실패', 'error');
    }
  };

  const deleteRepo = async (repo: MissionRepo) => {
    if (!confirm(`${repo.name} 삭제하시겠습니까? 관련 submission도 삭제됩니다.`)) return;
    setDeleting(repo.id);
    try {
      await adminApi.repos.remove(repo.id);
      showToast('삭제 완료');
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos.all() });
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
      <div className="bg-white/90 backdrop-blur-sm border border-console-200/60 rounded-2xl px-4 py-3 text-xs text-console-600">
        <div className="font-semibold text-console-700 mb-1.5">상태 설명</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>
            <Badge tone="success" className="inline-block mr-1">
              active
            </Badge>{' '}
            전체 싱크 대상에 포함됨
          </span>
          <span>
            <Badge tone="highlight" className="inline-block mr-1">
              candidate
            </Badge>{' '}
            후보 상태, 수동으로 active로 승인 필요
          </span>
          <span>
            <Badge tone="danger" className="inline-block mr-1">
              excluded
            </Badge>{' '}
            싱크 대상에서 제외됨
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {(['', 'active', 'candidate', 'excluded'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                status === s ? 'bg-console-900 text-white' : 'bg-console-100 text-console-500 hover:bg-console-200'
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
                tabCategory === c ? 'bg-console-900 text-white' : 'bg-console-100 text-console-500 hover:bg-console-200'
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
          className="border border-base-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-primary-400"
        />
        <span className="text-xs text-base-400">{filteredRepos.length}개</span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => void continuousSyncMutation.mutate()}
            disabled={continuousSyncMutation.isPending || syncingRepos.size > 0}
            className="bg-accent-600 text-white rounded-xl px-3 py-1.5 text-sm hover:bg-accent-700 disabled:opacity-40"
          >
            {continuousSyncMutation.isPending ? '연속 싱크 중...' : '연속 싱크'}
          </button>
          <button
            onClick={() => void syncAllBase()}
            disabled={syncingRepos.size > 0}
            className="bg-gradient-to-br from-brand-teal to-brand-sky text-white rounded-xl px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-40"
          >
            Base 전체 싱크
          </button>
          <button
            onClick={() => discoverMutation.mutate()}
            disabled={discoverMutation.isPending}
            className="bg-gradient-to-br from-brand-teal to-brand-sky text-white rounded-xl px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-40"
          >
            {discoverMutation.isPending ? '탐색 중...' : '레포 탐색'}
          </button>
        </div>
      </div>

      {selectedRepoIds.size > 0 && (
        <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium text-primary-700">{selectedRepoIds.size}개 선택됨</span>
          <select
            value={batchTrackValue}
            onChange={(e) => setBatchTrackValue(e.target.value)}
            className="text-sm border border-primary-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary-400"
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
            className="text-sm px-3 py-1 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40"
          >
            {batchTrackMutation.isPending ? '변경 중...' : '일괄 변경'}
          </button>
          <button
            onClick={() => setSelectedRepoIds(new Set())}
            className="text-sm px-3 py-1 rounded-lg border border-base-300 text-base-600 hover:bg-base-50"
          >
            선택 해제
          </button>
        </div>
      )}

      {isLoading ? (
        <EmptyState>로딩 중...</EmptyState>
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
