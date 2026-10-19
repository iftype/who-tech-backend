import type { RefObject } from 'react';

import { logColor, type StreamLogEntry } from '../../lib/stream-log.js';

export function SyncLogConsole({ logs, endRef }: { logs: StreamLogEntry[]; endRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="bg-base-900 rounded border border-base-700 p-4 font-mono text-xs max-h-96 overflow-y-auto">
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
