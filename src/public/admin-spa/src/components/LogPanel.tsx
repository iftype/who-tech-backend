import { useState, useEffect, useRef, useCallback } from 'react';

export interface LogEntry {
  ts: number;
  tag: 'ok' | 'err' | 'run' | 'info';
  msg: string;
}

let logListeners: ((entry: LogEntry) => void)[] = [];

export function addLog(tag: LogEntry['tag'], msg: string) {
  const entry: LogEntry = { ts: Date.now(), tag, msg };
  logListeners.forEach((fn) => fn(entry));
}

export default function LogPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (entry: LogEntry) => {
      setEntries((prev) => [...prev, entry]);
    };
    logListeners.push(handler);
    return () => {
      logListeners = logListeners.filter((fn) => fn !== handler);
    };
  }, []);

  useEffect(() => {
    if (!collapsed && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [entries, collapsed]);

  const clear = useCallback(() => setEntries([]), []);

  const formatTs = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const tagColors: Record<string, string> = {
    ok: 'text-green-400',
    err: 'text-red-400',
    run: 'text-blue-400',
    info: 'text-gray-500',
  };

  const msgColors: Record<string, string> = {
    ok: 'text-green-300',
    err: 'text-red-300',
    run: 'text-blue-300',
    info: 'text-gray-400',
  };

  const tagLabels: Record<string, string> = {
    ok: 'OK',
    err: 'ERR',
    run: 'RUN',
    info: 'INF',
  };

  return (
    <div
      style={{ zoom: 'var(--admin-zoom, 1)' }}
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-900 text-slate-200 font-mono text-xs shadow-[0_-4px_24px_rgba(0,0,0,0.3)]"
    >
      <div
        className="flex items-center justify-between px-4 py-1.5 bg-slate-800 cursor-pointer select-none"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Activity Log ({entries.length})
        </span>
        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={clear}
            className="text-[11px] px-2 py-0.5 rounded border border-slate-700 text-slate-500 hover:bg-slate-700 hover:text-slate-200 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-[11px] px-2 py-0.5 rounded border border-slate-700 text-slate-500 hover:bg-slate-700 hover:text-slate-200 transition-colors"
          >
            {collapsed ? '▲' : '▼'}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div
          ref={bodyRef}
          className="max-h-40 overflow-y-auto py-1"
        >
          {entries.length === 0 && (
            <div className="flex items-baseline gap-2.5 px-4 py-0.5">
              <span className="text-slate-700 shrink-0">--:--:--</span>
              <span className="text-slate-600 font-bold shrink-0">INF</span>
              <span className="text-slate-500">로그 대기 중...</span>
            </div>
          )}
          {entries.map((e, i) => (
            <div
              key={i}
              className="flex items-baseline gap-2.5 px-4 py-0.5 hover:bg-slate-800/50"
            >
              <span className="text-slate-700 shrink-0">{formatTs(e.ts)}</span>
              <span className={`font-bold shrink-0 ${tagColors[e.tag]}`}>
                {tagLabels[e.tag]}
              </span>
              <span className={msgColors[e.tag]}>{e.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
