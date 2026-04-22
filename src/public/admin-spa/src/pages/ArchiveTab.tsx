import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api.js';
import { showToast } from '../components/ui/Toast.js';
import { createEventSource } from '../lib/sse.js';
import type { CohortRepo, MissionRepo } from '../lib/types.js';

interface LogEntry {
  ts: number;
  type: 'progress' | 'done' | 'error' | 'info';
  message: string;
}

function formatStep(data: unknown): string {
  if (typeof data === 'string') return data;
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;
    const parts: string[] = [];
    if (d['repo']) parts.push(String(d['repo']));
    if (d['message']) parts.push(String(d['message']));
    if (d['count'] !== undefined) parts.push(`${d['count']}건`);
    if (d['percent'] !== undefined) parts.push(`${d['percent']}%`);
    if (parts.length) return parts.join(' · ');
    return JSON.stringify(data);
  }
  return String(data);
}

export default function ArchiveTab() {
  const queryClient = useQueryClient();
  const [cohort, setCohort] = useState('');
  const [track, setTrack] = useState('');
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [syncRunning, setSyncRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  const cohortNum = cohort ? Number(cohort) : NaN;

  const { data: mdData, isLoading: mdLoading } = useQuery({
    queryKey: ['archive', cohort, track],
    queryFn: async () => {
      if (!cohort) return null;
      const params = new URLSearchParams({ cohort, format: 'md' });
      if (track) params.set('track', track);
      const res = await fetch(`/admin/archive?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') ?? ''}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.text();
    },
    enabled: !!cohort,
  });

  const { data: cohortRepos = [], isLoading: reposLoading } = useQuery({
    queryKey: ['cohort-repos', cohortNum],
    queryFn: () => apiFetch<CohortRepo[]>(`/admin/cohort-repos?cohort=${cohortNum}`),
    enabled: Number.isFinite(cohortNum) && cohortNum > 0,
  });

  const { data: allRepos = [] } = useQuery({
    queryKey: ['repos'],
    queryFn: () => apiFetch<MissionRepo[]>('/admin/repos'),
  });

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    setLogs((prev) => [...prev, { ts: Date.now(), type, message }]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const stopSync = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setSyncRunning(false);
  }, []);

  const runCohortReposSync = useCallback(() => {
    if (syncRunning || !Number.isFinite(cohortNum)) return;
    setLogs([]);
    setSyncRunning(true);
    addLog('info', '기수 레포 업데이트 시작');

    const es = createEventSource(`/admin/sync/cohort-repos/stream?cohort=${cohortNum}`);
    esRef.current = es;

    es.addEventListener('progress', (e: MessageEvent) => {
      try {
        addLog('progress', formatStep(JSON.parse(e.data as string)));
      } catch {
        addLog('progress', e.data as string);
      }
    });
    es.addEventListener('done', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data as string) as Record<string, unknown>;
        addLog('done', d['message'] ? String(d['message']) : '완료');
      } catch {
        addLog('done', '완료');
      }
      stopSync();
    });
    es.addEventListener('error', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data as string) as Record<string, unknown>;
        addLog('error', d['message'] ? String(d['message']) : '오류 발생');
      } catch {
        addLog('error', '연결 오류');
      }
      stopSync();
    });
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) stopSync();
    };
  }, [syncRunning, cohortNum, addLog, stopSync]);

  const autoFillMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ added: number }>('/admin/cohort-repos/auto-fill', {
        method: 'POST',
        body: JSON.stringify({ cohort: cohortNum }),
      }),
    onSuccess: (result) => {
      showToast(`${result.added}개 레포 자동 추가 완료`);
      void queryClient.invalidateQueries({ queryKey: ['cohort-repos'] });
      void queryClient.invalidateQueries({ queryKey: ['archive'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '자동 채우기 실패', 'error'),
  });

  const addRepoMutation = useMutation({
    mutationFn: (missionRepoId: number) =>
      apiFetch<CohortRepo>('/admin/cohort-repos', {
        method: 'POST',
        body: JSON.stringify({ cohort: cohortNum, missionRepoId }),
      }),
    onSuccess: () => {
      showToast('레포 추가 완료');
      setSelectedRepoId('');
      void queryClient.invalidateQueries({ queryKey: ['cohort-repos'] });
      void queryClient.invalidateQueries({ queryKey: ['archive'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '추가 실패', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/cohort-repos/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      showToast('삭제 완료');
      void queryClient.invalidateQueries({ queryKey: ['cohort-repos'] });
      void queryClient.invalidateQueries({ queryKey: ['archive'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '삭제 실패', 'error'),
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, order }: { id: number; order: number }) =>
      apiFetch<CohortRepo>(`/admin/cohort-repos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ order }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cohort-repos'] });
      void queryClient.invalidateQueries({ queryKey: ['archive'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '순서 변경 실패', 'error'),
  });

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const current = cohortRepos[index];
    const prev = cohortRepos[index - 1];
    const currentOrder = current.order;
    const prevOrder = prev.order;
    updateOrderMutation.mutate(
      { id: current.id, order: prevOrder },
      {
        onSuccess: () => {
          updateOrderMutation.mutate({ id: prev.id, order: currentOrder });
        },
      },
    );
  };

  const moveDown = (index: number) => {
    if (index >= cohortRepos.length - 1) return;
    const current = cohortRepos[index];
    const next = cohortRepos[index + 1];
    const currentOrder = current.order;
    const nextOrder = next.order;
    updateOrderMutation.mutate(
      { id: current.id, order: nextOrder },
      {
        onSuccess: () => {
          updateOrderMutation.mutate({ id: next.id, order: currentOrder });
        },
      },
    );
  };

  const handleAddRepo = () => {
    const id = Number(selectedRepoId);
    if (!id || isNaN(id)) {
      showToast('레포를 선택하세요', 'error');
      return;
    }
    addRepoMutation.mutate(id);
  };

  const existingRepoIds = new Set(cohortRepos.map((cr) => cr.missionRepoId));
  const availableRepos = allRepos.filter((r) => !existingRepoIds.has(r.id));

  const logColor = (type: LogEntry['type']) => {
    if (type === 'done') return 'text-green-400';
    if (type === 'error') return 'text-red-400';
    if (type === 'info') return 'text-blue-400';
    return 'text-gray-300';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="text-xs text-gray-500 block mb-1">기수 (필수)</label>
          <input
            type="number"
            value={cohort}
            onChange={(e) => setCohort(e.target.value)}
            placeholder="예: 8"
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-20"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">트랙 (선택)</label>
          <select
            value={track}
            onChange={(e) => setTrack(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">전체</option>
            <option value="frontend">frontend</option>
            <option value="backend">backend</option>
            <option value="android">android</option>
          </select>
        </div>
      </div>

      {Number.isFinite(cohortNum) && cohortNum > 0 && (
        <div className="bg-white border border-gray-200 rounded p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-gray-700">
              기수별 레포 순서{' '}
              <span className="text-gray-400 font-normal">({cohortRepos.length}개)</span>
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => autoFillMutation.mutate()}
                disabled={autoFillMutation.isPending}
                className="bg-purple-600 text-white text-xs rounded px-3 py-1.5 hover:bg-purple-700 disabled:opacity-40"
              >
                {autoFillMutation.isPending ? '채우는 중...' : '자동 채우기'}
              </button>
              <button
                onClick={runCohortReposSync}
                disabled={syncRunning}
                className="bg-blue-600 text-white text-xs rounded px-3 py-1.5 hover:bg-blue-700 disabled:opacity-40"
              >
                {syncRunning ? '싱크 중...' : '목록 전체 재 Sync'}
              </button>
              {syncRunning && (
                <button
                  onClick={stopSync}
                  className="bg-red-500 text-white text-xs rounded px-3 py-1.5 hover:bg-red-600"
                >
                  중단
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm min-w-[200px]"
            >
              <option value="">레포 선택</option>
              {availableRepos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.track ? `(${r.track})` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddRepo}
              disabled={addRepoMutation.isPending || !selectedRepoId}
              className="bg-gray-700 text-white text-xs rounded px-3 py-1.5 hover:bg-gray-800 disabled:opacity-40"
            >
              {addRepoMutation.isPending ? '추가 중...' : '추가'}
            </button>
          </div>

          {reposLoading ? (
            <div className="py-8 text-center text-gray-400 text-sm">로딩 중...</div>
          ) : (
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">순서</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">레포</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">트랙</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">레벨</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cohortRepos.map((cr, index) => (
                    <tr key={cr.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveUp(index)}
                            disabled={index === 0 || updateOrderMutation.isPending}
                            className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1"
                            title="위로"
                          >
                            ↑
                          </button>
                          <span className="text-xs text-gray-600 font-mono w-6 text-center">
                            {cr.order}
                          </span>
                          <button
                            onClick={() => moveDown(index)}
                            disabled={index === cohortRepos.length - 1 || updateOrderMutation.isPending}
                            className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1"
                            title="아래로"
                          >
                            ↓
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <a
                          href={cr.missionRepo.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs font-medium"
                        >
                          {cr.missionRepo.name}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {cr.missionRepo.track ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {cr.missionRepo.level ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => {
                            if (confirm(`${cr.missionRepo.name}을(를) 삭제하시겠습니까?`)) {
                              deleteMutation.mutate(cr.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-40 px-1"
                          title="삭제"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cohortRepos.length === 0 && (
                <div className="py-8 text-center text-gray-400 text-sm">
                  등록된 레포가 없습니다. 자동 채우기를 사용하거나 직접 추가하세요.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {logs.length > 0 && (
        <div className="bg-gray-900 rounded border border-gray-700 p-4 font-mono text-xs max-h-48 overflow-y-auto">
          {logs.map((entry, i) => (
            <div key={i} className={`${logColor(entry.type)} leading-5`}>
              <span className="text-gray-600 mr-2">
                {new Date(entry.ts).toLocaleTimeString('ko-KR')}
              </span>
              {entry.message}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">아카이브 미리보기</h3>
        {mdLoading && <div className="py-8 text-center text-gray-400 text-sm">로딩 중...</div>}
        {mdData && (
          <div className="bg-gray-900 rounded border border-gray-700 p-4 font-mono text-xs text-gray-300 max-h-[50vh] overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {mdData}
          </div>
        )}
        {!cohort && !mdData && (
          <div className="py-12 text-center text-gray-400 text-sm">
            기수를 입력하면 아카이브 마크다운이 표시됩니다
          </div>
        )}
      </div>
    </div>
  );
}
