import { useCallback, useEffect, useRef, useState } from 'react';

import { createEventSource } from '../lib/sse.js';
import { formatStep, type StreamLogEntry } from '../lib/stream-log.js';

// 서버가 끝을 알린 방식: done 이벤트, error 이벤트, 연결 끊김
export type StreamEnd = 'done' | 'error' | 'closed';

// 서버가 보내는 작업 진행 상황(SSE)을 로그 줄로 쌓는다. 새 스트림을 열면 이전 스트림을 닫고 로그를 지운다.
// 화면이 사라지면 연결을 닫는다 (닫지 않으면 브라우저가 계속 재연결하고 사라진 화면에 setState 한다)
export function useEventStreamLog() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<StreamLogEntry[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: StreamLogEntry['type'], message: string) => {
    setLogs((prev) => [...prev, { ts: Date.now(), type, message }]);
  }, []);

  // 줄이 늘어날 때마다 끝으로 스크롤 (줄마다 타이머를 걸지 않는다)
  useEffect(() => {
    if (logs.length > 0) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  const stop = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setRunning(false);
  }, []);

  useEffect(
    () => () => {
      esRef.current?.close();
      esRef.current = null;
    },
    [],
  );

  const follow = useCallback(
    (url: string, firstMessage: string, onEnd?: (end: StreamEnd) => void) => {
      esRef.current?.close();
      setLogs([]);
      setRunning(true);
      addLog('info', firstMessage);

      const es = createEventSource(url);
      esRef.current = es;
      // 다른 스트림으로 바뀐 뒤 늦게 도착한 이벤트는 버린다
      const isCurrent = () => esRef.current === es;

      es.addEventListener('progress', (e: MessageEvent) => {
        if (!isCurrent()) return;
        try {
          addLog('progress', formatStep(JSON.parse(e.data as string)));
        } catch {
          addLog('progress', e.data as string);
        }
      });
      es.addEventListener('done', (e: MessageEvent) => {
        if (!isCurrent()) return;
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
        if (!isCurrent()) return;
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
        if (!isCurrent()) return;
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
