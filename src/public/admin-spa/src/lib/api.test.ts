import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api';

const fetchMock = vi.fn();

function response(status: number, body: unknown, raw?: string) {
  const text = raw ?? JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => text,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  window.location.hash = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('should send JSON headers and the stored admin token', async () => {
    localStorage.setItem('admin_token', 'secret');
    fetchMock.mockResolvedValue(response(200, { ok: true }));

    await expect(apiFetch('/admin/status', { method: 'POST', headers: { 'X-Extra': '1' } })).resolves.toEqual({
      ok: true,
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/admin\/status$/);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer secret',
      'X-Extra': '1',
    });
  });

  it('should omit the Authorization header without a token', async () => {
    fetchMock.mockResolvedValue(response(200, []));
    await apiFetch('/admin/repos');
    expect(fetchMock.mock.calls[0]![1].headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('should clear the token and go to login on 401', async () => {
    localStorage.setItem('admin_token', 'expired');
    fetchMock.mockResolvedValue(response(401, {}));

    await expect(apiFetch('/admin/repos')).rejects.toThrow('Unauthorized');
    expect(localStorage.getItem('admin_token')).toBeNull();
    expect(window.location.hash).toBe('#/login');
  });

  it('should use the JSON message and expose remaining seconds on errors', async () => {
    fetchMock.mockResolvedValue(response(429, { message: 'too many', remainingSeconds: 12 }));

    const error = await apiFetch('/admin/sync').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('429: too many');
    expect((error as Error & { remainingSeconds: number }).remainingSeconds).toBe(12);
  });

  it('should fall back to the raw text for non-JSON errors', async () => {
    fetchMock.mockResolvedValue(response(500, undefined, 'Internal Server Error'));
    await expect(apiFetch('/admin/x')).rejects.toThrow('500: Internal Server Error');
  });
});

describe('apiFetch with a real Response', () => {
  it('should keep the raw text of a non-JSON error body (body can be read only once)', async () => {
    fetchMock.mockResolvedValue(new Response('Bad Gateway from nginx', { status: 502 }));
    await expect(apiFetch('/admin/x')).rejects.toThrow('502: Bad Gateway from nginx');
  });

  it('should announce an expired session so the app can log out', async () => {
    localStorage.setItem('admin_token', 'expired');
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
    const onExpired = vi.fn();
    window.addEventListener('admin:unauthorized', onExpired);

    await expect(apiFetch('/admin/repos')).rejects.toThrow('Unauthorized');

    window.removeEventListener('admin:unauthorized', onExpired);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});

describe('pollSyncJob', () => {
  it('should stop polling when the job is cancelled', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(response(200, { id: 'j1', status: 'cancelled' }));
    const onUpdate = vi.fn();

    const { pollSyncJob } = await import('./api');
    pollSyncJob('j1', onUpdate);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ id: 'j1', status: 'cancelled' });
    vi.useRealTimers();
  });
});
