import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();
vi.mock('../lib/api.js', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));
vi.mock('../lib/sse.js', () => ({ createEventSource: vi.fn() }));
vi.mock('../components/ui/Toast.js', () => ({ showToast: vi.fn() }));

const { default: ArchiveTab } = await import('./ArchiveTab');

describe('ArchiveTab', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue([]);
  });

  it('should load mission repos without requesting cohort repos before a cohort is chosen', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <ArchiveTab />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/admin/repos'));
    expect(apiFetch.mock.calls.some(([path]) => String(path).startsWith('/admin/cohort-repos'))).toBe(false);
    expect(container.textContent).not.toBe('');
  });
});
