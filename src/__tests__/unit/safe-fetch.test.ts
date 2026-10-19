import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { fetchPublic, UnsafeUrlError } from '../../infra/rss/safe-fetch.js';

const realFetch = global.fetch;

function redirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

describe('fetchPublic', () => {
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('should return a direct response and never let fetch follow redirects itself', async () => {
    const fetchMock = jest.fn(async () => new Response('ok', { status: 200 }));
    global.fetch = fetchMock as never;

    const res = await fetchPublic('https://velog.io/@a', { method: 'GET' });

    expect(await res.text()).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown[])[1]).toMatchObject({ method: 'GET', redirect: 'manual' });
  });

  it('should follow public redirects including relative locations', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(redirect('https://bit.ly/b'))
      .mockResolvedValueOnce(redirect('/feed', 301))
      .mockResolvedValueOnce(new Response('feed', { status: 200 }));
    global.fetch = fetchMock as never;

    const res = await fetchPublic('https://t.co/a');

    expect(await res.text()).toBe('feed');
    expect(String((fetchMock.mock.calls[2] as unknown[])[0])).toBe('https://bit.ly/feed');
  });

  it('should refuse to start on a private address', async () => {
    const fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock as never;
    await expect(fetchPublic('http://127.0.0.1:3000/admin')).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should throw when a public url redirects to a private one', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(redirect('http://169.254.169.254/latest/meta-data'));
    global.fetch = fetchMock as never;

    await expect(fetchPublic('https://evil.example.com')).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should throw after more than 5 redirects', async () => {
    const fetchMock = jest.fn(async () => redirect('https://loop.example.com/again'));
    global.fetch = fetchMock as never;

    await expect(fetchPublic('https://loop.example.com')).rejects.toThrow('too many redirects');
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});
