import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Member } from '../../lib/types';

const remove = vi.fn();
vi.mock('../../lib/admin-api.js', () => ({
  adminApi: { members: { remove: (...args: unknown[]) => remove(...args) } },
}));
vi.mock('../../components/ui/Toast.js', () => ({ showToast: vi.fn() }));

const { useMemberActions } = await import('./useMemberActions');

const members = [
  { id: 1, githubId: 'a' },
  { id: 2, githubId: 'b' },
] as Member[];
const LIST_KEY = ['members', { q: 'x' }];

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(LIST_KEY, members);
  const onRefresh = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useMemberActions(onRefresh), { wrapper });
  return { client, onRefresh, result };
}

beforeEach(() => {
  remove.mockReset();
  vi.stubGlobal('confirm', () => true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMemberActions.deleteMember', () => {
  it('should remove the row from the cached list before the server answers', async () => {
    let resolve: () => void = () => undefined;
    remove.mockReturnValue(new Promise<void>((r) => (resolve = r)));
    const { client, result } = setup();

    act(() => result.current.deleteMember(members[0]!));

    await waitFor(() => expect(client.getQueryData<Member[]>(LIST_KEY)?.map((m) => m.id)).toEqual([2]));
    resolve();
  });

  it('should restore the row when the delete fails', async () => {
    remove.mockRejectedValue(new Error('boom'));
    const { client, result } = setup();

    act(() => result.current.deleteMember(members[0]!));

    await waitFor(() => expect(client.getQueryData<Member[]>(LIST_KEY)?.map((m) => m.id)).toEqual([1, 2]));
  });

  it('should refresh the list once after a successful delete', async () => {
    remove.mockResolvedValue(undefined);
    const { client, onRefresh, result } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    act(() => result.current.deleteMember(members[0]!));

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
