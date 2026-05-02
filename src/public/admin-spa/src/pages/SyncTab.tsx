import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createEventSource } from '../lib/sse.js';
import { apiFetch } from '../lib/api.js';
import { showToast } from '../components/ui/Toast.js';
import type { AdminStatus, MissionRepo, Workspace, SyncQueueJob } from '../lib/types.js';

type JobType = 'sync' | 'continuous' | 'cohort-repos';

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

export default function SyncTab() {
  const [cohortInput, setCohortInput] = useState('');
  const [running, setRunning] = useState<JobType | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [remainingTime, setRemainingTime] = useState('');

  const getNextSyncTime = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(now.getHours() + 1, 0, 0, 0);
    return next;
  };

  const formatRemainingTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}분 ${seconds}초`;
  };

  useEffect(() => {
    const updateRemaining = () => {
      const now = new Date();
      const next = getNextSyncTime();
      const diff = next.getTime() - now.getTime();
      setRemainingTime(formatRemainingTime(diff));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, []);

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['admin-status'],
    queryFn: () => apiFetch<AdminStatus>('/admin/status'),
    staleTime: 60_000,
  });

  const { data: workspace } = useQuery({
    queryKey: ['workspace'],
    queryFn: () => apiFetch<Workspace>('/admin/workspace'),
    staleTime: 300_000,
  });

  const { data: repos = [] } = useQuery({
    queryKey: ['repos', 'sync-schedule'],
    queryFn: () => apiFetch<MissionRepo[]>('/admin/repos'),
  });

  const continuousRepos = repos.filter((r) => r.status === 'active' && r.syncMode === 'continuous');

  interface SyncJob {
    id: string;
    status: string;
    message: string;
    startedAt: string;
    finishedAt: string | null;
    repoName?: string;
    source?: string;
  }

  const { data: repoJobs = [] } = useQuery({
    queryKey: ['repo-sync-jobs'],
    queryFn: () => apiFetch<SyncJob[]>('/admin/repos/sync-jobs'),
    staleTime: 10_000,
    refetchInterval: running ? 2000 : 10_000,
  });

  const { data: blogJobs = [] } = useQuery({
    queryKey: ['blog-sync-jobs'],
    queryFn: () => apiFetch<SyncJob[]>('/admin/blog/sync-jobs'),
    staleTime: 10_000,
    refetchInterval: running ? 2000 : 10_000,
  });

  const { data: queueJobs = [] } = useQuery({
    queryKey: ['sync-queue-jobs'],
    queryFn: () => apiFetch<SyncQueueJob[]>('/admin/sync/jobs'),
    staleTime: 0,
    refetchInterval: 3000,
  });

  const activeQueueJobs = queueJobs.filter((j) => j.status === 'queued' || j.status === 'running');
  const recentQueueJobs = queueJobs.filter(
    (j) => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled',
  );

  const allJobs = [...recentQueueJobs, ...repoJobs, ...blogJobs].sort((a, b) => {
    const aDate = new Date(
      (a as SyncQueueJob).completedAt ?? (a as typeof repoJobs[number]).startedAt ?? 0,
    );
    const bDate = new Date(
      (b as SyncQueueJob).completedAt ?? (b as typeof repoJobs[number]).startedAt ?? 0,
    );
    return bDate.getTime() - aDate.getTime();
  });

  const queryClient = useQueryClient();

  const blogSyncMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ synced: number; newPosts: number }>('/admin/blog/sync', { method: 'POST' }),
    onSuccess: (result) => {
      showToast(`블로그 싱크 완료 — ${result.synced}개 피드, 새 글 ${result.newPosts}개`);
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '블로그 싱크 실패', 'error'),
  });

  const profileRefreshMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ checked: number; refreshed: number; failed: number }>('/admin/members/refresh-profiles', { method: 'POST' }),
    onSuccess: (result) => {
      showToast(`프로필 새로고침 완료 — ${result.refreshed}/${result.checked}명, 실패 ${result.failed}명`);
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '프로필 새로고침 실패', 'error'),
  });

  const toggleBlogSyncMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetch<Workspace>('/admin/workspace', {
        method: 'PUT',
        body: JSON.stringify({ blogSyncEnabled: enabled }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '변경 실패', 'error'),
  });

  const toggleProfileRefreshMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetch<Workspace>('/admin/workspace', {
        method: 'PUT',
        body: JSON.stringify({ profileRefreshEnabled: enabled }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '변경 실패', 'error'),
  });

  const enqueueMutation = useMutation({
    mutationFn: (params: { type: 'workspace' | 'continuous' | 'cohort-repos'; cohort?: number }) =>
      apiFetch<{ id: string; status: string; createdAt: string }>('/admin/sync/jobs', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['sync-queue-jobs'] });
      showToast('작업이 큐에 추가되었습니다');
      setLogs([]);
      setRunning(result.id as unknown as JobType);
      addLog('info', `작업 ${result.id} 시작 대기 중`);
      const es = createEventSource(`/admin/sync/jobs/${result.id}/stream`);
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
          const msg = d['message'] ? String(d['message']) : '완료';
          addLog('done', msg);
        } catch {
          addLog('done', '완료');
        }
        stop();
        void refetchStatus();
        void queryClient.invalidateQueries({ queryKey: ['sync-queue-jobs'] });
      });
      es.addEventListener('error', (e: MessageEvent) => {
        try {
          const d = JSON.parse(e.data as string) as Record<string, unknown>;
          addLog('error', d['message'] ? String(d['message']) : '오류 발생');
        } catch {
          addLog('error', '연결 오류');
        }
        stop();
        void queryClient.invalidateQueries({ queryKey: ['sync-queue-jobs'] });
      });
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          stop();
          void queryClient.invalidateQueries({ queryKey: ['sync-queue-jobs'] });
        }
      };
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '큐 추가 실패', 'error'),
  });

  const cancelJobMutation = useMutation({
    mutationFn: (jobId: string) =>
      apiFetch<{ success: boolean }>(`/admin/sync/jobs/${jobId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sync-queue-jobs'] });
      showToast('작업이 취소되었습니다');
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '취소 실패', 'error'),
  });

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    setLogs((prev) => [...prev, { ts: Date.now(), type, message }]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const stop = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setRunning(null);
  }, []);

  const runSync = () => {
    enqueueMutation.mutate({
      type: 'workspace',
      ...(cohortInput ? { cohort: Number(cohortInput) } : {}),
    });
  };

  const runContinuous = () => enqueueMutation.mutate({ type: 'continuous' });

  const runCohortRepos = () => {
    if (!cohortInput) return;
    enqueueMutation.mutate({ type: 'cohort-repos', cohort: Number(cohortInput) });
  };

  const logColor = (type: LogEntry['type']) => {
    if (type === 'done') return 'text-green-400';
    if (type === 'error') return 'text-red-400';
    if (type === 'info') return 'text-blue-400';
    return 'text-gray-300';
  };

  return (
    <div className="space-y-4">
      {/* 상태 */}
      {status && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <p className="text-xs text-gray-500">멤버 수</p>
            <p className="text-xl font-semibold text-gray-900">{status.memberCount}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <p className="text-xs text-gray-500">활성 레포</p>
            <p className="text-xl font-semibold text-gray-900">{status.activeRepoCount}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <p className="text-xs text-gray-500">마지막 싱크</p>
            <p className="text-sm font-medium text-gray-700">
              {status.lastSyncAt
                ? new Date(status.lastSyncAt).toLocaleString('ko-KR')
                : '없음'}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded p-4 space-y-3">
        <h3 className="text-xs font-semibold text-gray-600">싱크 스케줄 상태</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">블로그 RSS 자동 싱크</span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${
                  workspace?.blogSyncEnabled
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
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
                  workspace?.profileRefreshEnabled
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
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
                마지막: {new Date(status.lastProfileRefreshAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
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

      {/* 블로그 싱크 */}
      <div className="bg-white border border-gray-200 rounded p-4">
        <h3 className="text-xs font-semibold text-gray-600 mb-2">블로그</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => blogSyncMutation.mutate()}
            disabled={blogSyncMutation.isPending}
            className="bg-blue-600 text-white text-sm rounded px-4 py-1.5 hover:bg-blue-700 disabled:opacity-40"
          >
            {blogSyncMutation.isPending ? 'RSS 싱크 중...' : 'RSS 전체 싱크'}
          </button>
          <label className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={workspace?.blogSyncEnabled ?? false}
              onChange={(e) => toggleBlogSyncMutation.mutate(e.target.checked)}
              disabled={toggleBlogSyncMutation.isPending}
              className="rounded"
            />
            <span className="text-xs text-gray-700">자동 싱크</span>
          </label>
        </div>
      </div>

      {/* 프로필 새로고침 */}
      <div className="bg-white border border-gray-200 rounded p-4">
        <h3 className="text-xs font-semibold text-gray-600 mb-2">프로필</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => profileRefreshMutation.mutate()}
            disabled={profileRefreshMutation.isPending}
            className="bg-green-600 text-white text-sm rounded px-4 py-1.5 hover:bg-green-700 disabled:opacity-40"
          >
            {profileRefreshMutation.isPending ? '프로필 새로고침 중...' : '프로필 전체 새로고침'}
          </button>
          <label className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={workspace?.profileRefreshEnabled ?? false}
              onChange={(e) => toggleProfileRefreshMutation.mutate(e.target.checked)}
              disabled={toggleProfileRefreshMutation.isPending}
              className="rounded"
            />
            <span className="text-xs text-gray-700">자동 새로고침</span>
          </label>
        </div>
      </div>

      {/* 컨트롤 */}
      <div className="bg-white border border-gray-200 rounded p-4 space-y-3">
        <h3 className="text-xs font-semibold text-gray-600">미션 싱크</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="text-xs text-gray-500 block mb-1">기수 (선택)</label>
            <input
              type="number"
              value={cohortInput}
              onChange={(e) => setCohortInput(e.target.value)}
              placeholder="예: 9"
              className="border border-gray-300 rounded px-2 py-1.5 text-sm w-20"
              disabled={!!running}
            />
          </div>
          <div className="flex gap-2 items-end flex-wrap pt-4">
            <button
              onClick={runSync}
              disabled={enqueueMutation.isPending}
              className="bg-blue-600 text-white text-sm rounded px-4 py-1.5 hover:bg-blue-700 disabled:opacity-40"
            >
              {enqueueMutation.isPending ? '큐 추가 중...' : cohortInput ? `${cohortInput}기 싱크` : '전체 싱크'}
            </button>
            <button
              onClick={runContinuous}
              disabled={enqueueMutation.isPending}
              className="bg-purple-600 text-white text-sm rounded px-4 py-1.5 hover:bg-purple-700 disabled:opacity-40"
            >
              {enqueueMutation.isPending ? '큐 추가 중...' : '연속 싱크'}
            </button>
            <button
              onClick={runCohortRepos}
              disabled={enqueueMutation.isPending || !cohortInput}
              className="bg-gray-700 text-white text-sm rounded px-4 py-1.5 hover:bg-gray-800 disabled:opacity-40"
              title={!cohortInput ? '기수를 입력하세요' : undefined}
            >
              {enqueueMutation.isPending ? '큐 추가 중...' : '기수 레포 업데이트'}
            </button>
            {running && (
              <button
                onClick={stop}
                className="bg-red-500 text-white text-sm rounded px-4 py-1.5 hover:bg-red-600"
              >
                중단
              </button>
            )}
          </div>
        </div>
      </div>

      {activeQueueJobs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded p-4">
          <h3 className="text-xs font-semibold text-gray-600 mb-3">현재 싱크 작업 ({activeQueueJobs.length})</h3>
          <div className="max-h-64 overflow-y-auto rounded border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left font-medium text-gray-500 px-3 py-2">시작</th>
                  <th className="text-left font-medium text-gray-500 px-3 py-2">종류</th>
                  <th className="text-left font-medium text-gray-500 px-3 py-2">상태</th>
                  <th className="text-left font-medium text-gray-500 px-3 py-2">진행</th>
                  <th className="text-left font-medium text-gray-500 px-3 py-2">결과</th>
                  <th className="text-left font-medium text-gray-500 px-3 py-2">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeQueueJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {new Date(j.status === 'running' && j.startedAt ? j.startedAt : j.createdAt).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium border bg-blue-50 text-blue-700 border-blue-200">
                        {j.type === 'workspace' ? '전체' : j.type === 'continuous' ? '연속' : '기수레포'}
                        {j.cohort != null ? ` (${j.cohort}기)` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          j.status === 'queued'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {j.progress
                        ? `${j.progress.repo} (${j.progress.done}/${j.progress.total})`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-700 truncate max-w-[200px]">—</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => cancelJobMutation.mutate(j.id)}
                        disabled={cancelJobMutation.isPending}
                        className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40"
                      >
                        취소
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 로그 */}
      {logs.length > 0 && (
        <div className="bg-gray-900 rounded border border-gray-700 p-4 font-mono text-xs max-h-96 overflow-y-auto">
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

      {allJobs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded p-4">
          <h3 className="text-xs font-semibold text-gray-600 mb-3">최근 싱크 작업 ({allJobs.length})</h3>
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
                {allJobs.map((j) => {
                  const isQueueJob = !('repoName' in j);
                  const queueJob = j as SyncQueueJob;
                  const repoJob = j as typeof repoJobs[number];
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
                            {queueJob.type === 'workspace'
                              ? '전체'
                              : queueJob.type === 'continuous'
                                ? '연속'
                                : '기수레포'}
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
                            : queueJob.error ?? '—'
                          : `${repoJob.repoName ? `${repoJob.repoName} — ` : ''}${repoJob.message}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
