import type { SyncJob } from './types.js';
import { clearToken, getToken } from './auth.js';

// 401을 받으면 이 이벤트로 알린다. 토큰 상태를 가진 AuthContext가 듣고 로그인 화면으로 돌아간다
export const UNAUTHORIZED_EVENT = 'admin:unauthorized';

const BASE = '';

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    clearToken();
    window.location.hash = '#/login';
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    // 본문은 한 번만 읽을 수 있다. 텍스트로 읽고 JSON이면 message를, 아니면 원문을 쓴다
    const text = await res.text().catch(() => '');
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
    const message = body && typeof body === 'object' && 'message' in body ? String(body.message) : text;
    const err = new Error(`${res.status}: ${message}`);
    if (body && typeof body === 'object' && 'remainingSeconds' in body) {
      (err as Error & { remainingSeconds: number }).remainingSeconds = Number(body.remainingSeconds);
    }
    throw err;
  }
  return res.json() as Promise<T>;
}

export function pollSyncJob(jobId: string, onUpdate: (job: SyncJob) => void): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const job = await apiFetch<SyncJob>(`/admin/repos/sync-jobs/${jobId}`);
      onUpdate(job);
      if (job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled' && !stopped) {
        setTimeout(tick, 2000);
      }
    } catch {
      if (!stopped) setTimeout(tick, 2000);
    }
  };
  tick();
  return () => {
    stopped = true;
  };
}
