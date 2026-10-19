import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();
vi.mock('../../lib/api.js', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));

const { StatCards } = await import('./StatCards');

describe('StatCards', () => {
  it('should show the repo count from the status API as active repos', async () => {
    apiFetch.mockResolvedValue({ memberCount: 884, repoCount: 45, lastSyncAt: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <StatCards />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('884')).toBeInTheDocument();
    expect(screen.getByText('활성 레포').nextElementSibling).toHaveTextContent('45');
  });
});
