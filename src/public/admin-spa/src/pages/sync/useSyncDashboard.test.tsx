import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = {
  status: vi.fn(async () => ({})),
  githubStatus: vi.fn(async () => ({})),
  workspace: { get: vi.fn(async () => ({})) },
  repos: { list: vi.fn(async () => []), syncJobs: vi.fn(async () => []) },
  blog: { syncJobs: vi.fn(async () => []) },
  tecotalk: { list: vi.fn(async () => []) },
  sync: { jobs: vi.fn(async () => []) },
};
vi.mock('../../lib/admin-api.js', () => ({ adminApi: api }));

const { useSyncDashboard } = await import('./useSyncDashboard');

const queueJob = (id: string, type: string, status = 'completed') => ({
  id,
  type,
  status,
  createdAt: '2026-10-21T00:00:00Z',
  completedAt: '2026-10-21T00:01:00Z',
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSyncDashboard(false), { wrapper });
}

describe('useSyncDashboard', () => {
  beforeEach(() => {
    api.sync.jobs.mockResolvedValue([
      queueJob('q1', 'workspace'),
      queueJob('r1', 'repo'),
      queueJob('b1', 'blog'),
      queueJob('q2', 'continuous', 'running'),
    ] as never);
    api.repos.syncJobs.mockResolvedValue([
      {
        id: 'r1',
        status: 'completed',
        message: 'x',
        startedAt: '2026-10-21T00:00:00Z',
        finishedAt: null,
        repoName: 'java-lotto',
      },
    ] as never);
    api.blog.syncJobs.mockResolvedValue([
      { id: 'b1', status: 'completed', message: 'y', startedAt: '2026-10-21T00:00:00Z', finishedAt: null },
    ] as never);
  });

  it('should list a repo or blog job once, through its detailed endpoint, not again from the queue', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.recentJobs.length).toBeGreaterThan(0));

    const ids = result.current.recentJobs.map((j) => j.id);
    expect(ids.filter((id) => id === 'r1')).toHaveLength(1);
    expect(ids.filter((id) => id === 'b1')).toHaveLength(1);
    expect(ids).toContain('q1');
    expect(result.current.activeQueueJobs.map((j) => j.id)).toEqual(['q2']);
  });
});
