// SSE 스트림 진행 로그(싱크·아카이브 탭)의 공용 타입과 표시 함수

export interface StreamLogEntry {
  ts: number;
  type: 'progress' | 'done' | 'error' | 'info';
  message: string;
}

/** SSE progress 이벤트 데이터를 한 줄 텍스트로 */
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

export function logColor(type: StreamLogEntry['type']): string {
  if (type === 'done') return 'text-green-400';
  if (type === 'error') return 'text-red-400';
  if (type === 'info') return 'text-blue-400';
  return 'text-gray-300';
}
