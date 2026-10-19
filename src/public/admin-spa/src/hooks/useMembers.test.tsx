import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const list = vi.fn();
vi.mock('../lib/admin-api.js', () => ({ adminApi: { members: { list: (...a: unknown[]) => list(...a) } } }));

const { useMembers, SEARCH_DEBOUNCE_MS } = await import('./useMembers');
type Filters = Parameters<typeof useMembers>[0];

function setup(initial: Filters) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook((filters: Filters) => useMembers(filters), { wrapper, initialProps: initial });
}

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

beforeEach(() => {
  vi.useFakeTimers();
  list.mockReset();
  list.mockImplementation(async (params: string) => [{ id: params.length, githubId: params || 'all' }]);
});

afterEach(() => vi.useRealTimers());

describe('useMembers', () => {
  it('should request once after typing stops', async () => {
    const { rerender } = setup({});
    await flush();
    expect(list).toHaveBeenCalledTimes(1);

    rerender({ q: 'a' });
    rerender({ q: 'ab' });
    rerender({ q: 'abc' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 50);
    });
    expect(list).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenLastCalledWith('q=abc');
  });

  it('should keep the previous rows while the next filter loads', async () => {
    let resolveNext: (v: unknown) => void = () => undefined;
    const { result, rerender } = setup({});
    await flush();
    expect(result.current.members).toEqual([{ id: 0, githubId: 'all' }]);

    list.mockImplementationOnce(() => new Promise((r) => (resolveNext = r)));
    rerender({ role: 'coach' });
    await flush();

    expect(result.current.loading).toBe(false);
    expect(result.current.fetching).toBe(true);
    expect(result.current.members).toEqual([{ id: 0, githubId: 'all' }]);

    await act(async () => {
      resolveNext([{ id: 9, githubId: 'coach' }]);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.members).toEqual([{ id: 9, githubId: 'coach' }]);
  });

  it('should show loading only on the first load', async () => {
    const { result } = setup({});
    expect(result.current.loading).toBe(true);
    await flush();
    expect(result.current.loading).toBe(false);
  });
});
