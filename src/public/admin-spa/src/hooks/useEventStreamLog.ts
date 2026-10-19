import { useCallback, useRef, useState } from 'react';

import { createEventSource } from '../lib/sse.js';
import { formatStep, type StreamLogEntry } from '../lib/stream-log.js';

// 서버가 끝을 알린 방식: done 이벤트, error 이벤트, 연결 끊김
export type StreamEnd = 'done' | 'error' | 'closed';

// 서버가 보내는 작업 진행 상황(SSE)을 로그 줄로 쌓는다. 새 스트림을 열면 이전 로그는 지운다
export function useEventStreamLog() {
  const [running, setRunning] = useState(false);
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
    setRunning(false);
  }, []);

  const follow = useCallback(
    (url: string, firstMessage: string, onEnd?: (end: StreamEnd) => void) => {
      setLogs([]);
      setRunning(true);
      addLog('info', firstMessage);

      const es = createEventSource(url);
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
        onEnd?.('done');
      });
      es.addEventListener('error', (e: MessageEvent) => {
        try {
          const d = JSON.parse(e.data as string) as Record<string, unknown>;
          addLog('error', d['message'] ? String(d['message']) : '오류 발생');
        } catch {
          addLog('error', '연결 오류');
        }
        stop();
        onEnd?.('error');
      });
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          stop();
          onEnd?.('closed');
        }
      };
    },
    [addLog, stop],
  );

  return { running, logs, logEndRef, follow, stop };
}
