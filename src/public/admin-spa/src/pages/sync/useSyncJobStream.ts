import { useCallback, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '../../components/ui/Toast.js';
import { createEventSource } from '../../lib/sse.js';
import { formatStep, type StreamLogEntry } from '../../lib/stream-log.js';
import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';
import type { JobType } from './sync-format.js';

type EnqueueParams = { type: 'workspace' | 'continuous' | 'cohort-repos'; cohort?: number };

// 싱크 작업을 큐에 넣고, 서버가 보내는 진행 상황(SSE)을 로그로 쌓는다
export function useSyncJobStream(onDone: () => void) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState<JobType | null>(null);
  const [logs, setLogs] = useState<StreamLogEntry[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: StreamLogEntry['type'], message: string) => {
    setLogs((prev) => [...prev, { ts: Date.now(), type, message }]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const stop = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setRunning(null);
  }, []);

  const invalidateQueue = () => void queryClient.invalidateQueries({ queryKey: queryKeys.syncQueueJobs() });

  const enqueueMutation = useMutation({
    mutationFn: (params: EnqueueParams) => adminApi.sync.createJob(params),
    onSuccess: (result) => {
      invalidateQueue();
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
          addLog('done', d['message'] ? String(d['message']) : '완료');
        } catch {
          addLog('done', '완료');
        }
        stop();
        onDone();
        invalidateQueue();
      });
      es.addEventListener('error', (e: MessageEvent) => {
        try {
          const d = JSON.parse(e.data as string) as Record<string, unknown>;
          addLog('error', d['message'] ? String(d['message']) : '오류 발생');
        } catch {
          addLog('error', '연결 오류');
        }
        stop();
        invalidateQueue();
      });
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          stop();
          invalidateQueue();
        }
      };
    },
    onError: (e) => showToast(e instanceof Error ? e.message : '큐 추가 실패', 'error'),
  });

  return {
    running,
    logs,
    logEndRef,
    stop,
    enqueue: (params: EnqueueParams) => enqueueMutation.mutate(params),
    isEnqueuing: enqueueMutation.isPending,
  };
}
