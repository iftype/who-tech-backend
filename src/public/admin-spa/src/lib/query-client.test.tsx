import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, useMutation } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const showToast = vi.fn();

const { createAdminQueryClient, toErrorMessage } = await import('./query-client');

function setup(mutationFn: () => Promise<unknown>, meta?: { errorMessage?: string; successMessage?: string }) {
  const client = createAdminQueryClient({ notify: showToast, retry: false });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useMutation({ mutationFn, ...(meta ? { meta } : {}) }), { wrapper });
}

describe('createAdminQueryClient', () => {
  beforeEach(() => showToast.mockReset());

  it('should show the server message when a mutation fails', async () => {
    const { result } = setup(() => Promise.reject(new Error('409: 이미 있는 단어')), { errorMessage: '추가 실패' });
    act(() => result.current.mutate());
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('409: 이미 있는 단어', 'error'));
  });

  it('should fall back to meta.errorMessage when the error has no message', async () => {
    const { result } = setup(() => Promise.reject('boom'), { errorMessage: '추가 실패' });
    act(() => result.current.mutate());
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('추가 실패', 'error'));
  });

  it('should show meta.successMessage on success', async () => {
    const { result } = setup(() => Promise.resolve(1), { successMessage: '저장 완료' });
    act(() => result.current.mutate());
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('저장 완료'));
  });

  it('should stay silent for mutations without meta', async () => {
    const { result } = setup(() => Promise.reject(new Error('x')));
    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).not.toHaveBeenCalled();
  });

  it('toErrorMessage prefers a non-empty message', () => {
    expect(toErrorMessage(new Error(''), 'fallback')).toBe('fallback');
    expect(toErrorMessage(new Error('real'), 'fallback')).toBe('real');
  });
});
