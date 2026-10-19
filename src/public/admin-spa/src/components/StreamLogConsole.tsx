import type { RefObject } from 'react';

import { logColor, type StreamLogEntry } from '../lib/stream-log.js';
import { cn } from '../lib/cn.js';

// 작업 진행 로그를 터미널처럼 보여 준다. 높이(max-h-*)는 놓이는 자리에서 정한다
export function StreamLogConsole({
  logs,
  endRef,
  className,
}: {
  logs: StreamLogEntry[];
  endRef: RefObject<HTMLDivElement | null>;
  className: string;
}) {
  return (
    <div className={cn('bg-base-900 rounded border border-base-700 p-4 font-mono text-xs overflow-y-auto', className)}>
      {logs.map((entry, i) => (
        <div key={i} className={`${logColor(entry.type)} leading-5`}>
          <span className="text-base-600 mr-2">{new Date(entry.ts).toLocaleTimeString('ko-KR')}</span>
          {entry.message}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
