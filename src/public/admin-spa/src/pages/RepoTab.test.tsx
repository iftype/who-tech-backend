import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MissionRepo } from '../lib/types';

const apiFetch = vi.fn();
vi.mock('../lib/api.js', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  pollSyncJob: vi.fn(() => () => {}),
}));
vi.mock('../components/ui/Toast.js', () => ({ showToast: vi.fn() }));
vi.mock('../components/LogPanel.js', () => ({ addLog: vi.fn() }));

const { default: RepoTab } = await import('./RepoTab');

function repo(id: number, overrides: Partial<MissionRepo> = {}): MissionRepo {
  return {
    id,
    name: `repo-${id}`,
    repoUrl: `https://github.com/woowacourse/repo-${id}`,
    track: 'backend',
    type: 'individual',
    tabCategory: 'base',
    status: 'active',
    syncMode: 'continuous',
    cohorts: [8],
    description: null,
    lastSyncAt: null,
    _count: { submissions: 0 },
    ...overrides,
  };
}

const REPOS = [
  repo(1, { name: 'java-racingcar', status: 'active' }),
  repo(2, { name: 'java-lotto', status: 'candidate', tabCategory: 'common' }),
  repo(3, { name: 'javascript-lotto', status: 'excluded', syncMode: 'once', tabCategory: 'precourse' }),
];

function renderRepoTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RepoTab />
    </QueryClientProvider>,
  );
}

const repoRequests = () =>
  apiFetch.mock.calls.filter(([path, init]) => String(path).startsWith('/admin/repos') && !init).map(([path]) => path);

describe('RepoTab', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return {};
      if (path.startsWith('/admin/repos')) return REPOS;
      return [];
    });
  });

  it('should list continuous and once repos', async () => {
    renderRepoTab();

    expect(await screen.findByText('java-racingcar')).toBeInTheDocument();
    expect(screen.getByText('java-lotto')).toBeInTheDocument();
    expect(screen.getByText('javascript-lotto')).toBeInTheDocument();
    expect(screen.getByText('3개')).toBeInTheDocument();
    expect(repoRequests()).toContain('/admin/repos');
  });

  it('should request repos by status with the real DB status values', async () => {
    renderRepoTab();
    await screen.findByText('java-racingcar');

    for (const status of ['active', 'candidate', 'excluded']) {
      await userEvent.click(screen.getAllByRole('button', { name: new RegExp(`^${status}$`) })[0]!);
      await waitFor(() => expect(repoRequests()).toContain(`/admin/repos?status=${status}`));
    }
    // 과거 버그: DB에 없는 inactive/once 상태 필터
    expect(screen.queryByRole('button', { name: 'inactive' })).not.toBeInTheDocument();
  });

  it.each([
    ['java-racingcar', 1, 'active', 'candidate'],
    ['java-lotto', 2, 'candidate', 'excluded'],
    ['javascript-lotto', 3, 'excluded', 'active'],
  ])('should cycle the status of %s (%s → %s)', async (name, id, current, next) => {
    renderRepoTab();
    const row = (await screen.findByText(name)).closest('tr')!;

    await userEvent.click(within(row).getByRole('button', { name: current }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(`/admin/repos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      }),
    );
  });

  it('should filter by tab category and search on the client', async () => {
    renderRepoTab();
    await screen.findByText('java-racingcar');

    await userEvent.click(screen.getByRole('button', { name: /^common$/ }));
    expect(screen.queryByText('java-racingcar')).not.toBeInTheDocument();
    expect(screen.getByText('java-lotto')).toBeInTheDocument();
    expect(screen.getByText('1개')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '전체 카테고리' }));
    await userEvent.type(screen.getByPlaceholderText('레포 검색...'), 'LOTTO');
    expect(screen.queryByText('java-racingcar')).not.toBeInTheDocument();
    expect(screen.getByText('java-lotto')).toBeInTheDocument();
    expect(screen.getByText('javascript-lotto')).toBeInTheDocument();
  });
});
