import type { SyncJob } from './types.js';

const BASE = '';

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('admin_token');
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('admin_token');
    window.location.hash = '#/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    let body: unknown;
    try {
      body = JSON.parse(await res.text());
    } catch {
      body = undefined;
    }
    const message =
      body && typeof body === 'object' && 'message' in body ? String(body.message) : await res.text().catch(() => '');
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
      if (job.status !== 'completed' && job.status !== 'failed' && !stopped) {
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
