import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { createEventSource } from '../lib/sse.js';
import { apiFetch } from '../lib/api.js';
import { showToast } from '../components/ui/Toast.js';
import type { AdminStatus } from '../lib/types.js';

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

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['admin-status'],
    queryFn: () => apiFetch<AdminStatus>('/admin/status'),
    staleTime: 60_000,
  });

  const blogSyncMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ synced: number; newPosts: number }>('/admin/blog/sync', { method: 'POST' }),
    onSuccess: (result) => {
      showToast(`블로그 싱크 완료 — ${result.synced}개 피드, 새 글 ${result.newPosts}개`);
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '블로그 싱크 실패', 'error'),
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

  const startJob = useCallback(
    (jobType: JobType, path: string) => {
      if (running) return;
      setLogs([]);
      setRunning(jobType);
      addLog('info', `${jobType} 시작`);

      const es = createEventSource(path);
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
      });

      es.addEventListener('error', (e: MessageEvent) => {
        try {
          const d = JSON.parse(e.data as string) as Record<string, unknown>;
          addLog('error', d['message'] ? String(d['message']) : '오류 발생');
        } catch {
          addLog('error', '연결 오류');
        }
        stop();
      });

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          stop();
        }
      };
    },
    [running, addLog, stop, refetchStatus],
  );

  const runSync = () => {
    const cohort = cohortInput ? `?cohort=${cohortInput}` : '';
    startJob('sync', `/admin/sync/stream${cohort}`);
  };

  const runContinuous = () => startJob('continuous', '/admin/sync/continuous/stream');

  const runCohortRepos = () => {
    if (!cohortInput) return;
    startJob('cohort-repos', `/admin/sync/cohort-repos/stream?cohort=${cohortInput}`);
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

      {/* 블로그 싱크 */}
      <div className="bg-white border border-gray-200 rounded p-4">
        <h3 className="text-xs font-semibold text-gray-600 mb-2">블로그</h3>
        <button
          onClick={() => blogSyncMutation.mutate()}
          disabled={blogSyncMutation.isPending}
          className="bg-blue-600 text-white text-sm rounded px-4 py-1.5 hover:bg-blue-700 disabled:opacity-40"
        >
          {blogSyncMutation.isPending ? 'RSS 싱크 중...' : 'RSS 전체 싱크'}
        </button>
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
              disabled={!!running}
              className="bg-blue-600 text-white text-sm rounded px-4 py-1.5 hover:bg-blue-700 disabled:opacity-40"
            >
              {running === 'sync' ? '싱크 중...' : cohortInput ? `${cohortInput}기 싱크` : '전체 싱크'}
            </button>
            <button
              onClick={runContinuous}
              disabled={!!running}
              className="bg-purple-600 text-white text-sm rounded px-4 py-1.5 hover:bg-purple-700 disabled:opacity-40"
            >
              {running === 'continuous' ? '연속 싱크 중...' : '연속 싱크'}
            </button>
            <button
              onClick={runCohortRepos}
              disabled={!!running || !cohortInput}
              className="bg-gray-700 text-white text-sm rounded px-4 py-1.5 hover:bg-gray-800 disabled:opacity-40"
              title={!cohortInput ? '기수를 입력하세요' : undefined}
            >
              {running === 'cohort-repos' ? '레포 업데이트 중...' : '기수 레포 업데이트'}
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
    </div>
  );
}
