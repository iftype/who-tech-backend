// SyncTab 공용 타입과 표시 포맷

export type JobType = 'sync' | 'continuous' | 'cohort-repos';

export interface LogEntry {
  ts: number;
  type: 'progress' | 'done' | 'error' | 'info';
  message: string;
}

export function formatStep(data: unknown): string {
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

export function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString('ko-KR') : '없음';
}

// 레포·블로그 싱크 작업 목록 항목
export interface RecentSyncJob {
  id: string;
  status: string;
  message: string;
  startedAt: string;
  finishedAt: string | null;
  repoName?: string;
  source?: string;
}
