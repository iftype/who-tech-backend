import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();
vi.mock('../lib/api.js', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  pollSyncJob: vi.fn(() => () => {}),
}));
vi.mock('../lib/sse.js', () => ({ createEventSource: vi.fn() }));
vi.mock('../components/ui/Toast.js', () => ({ showToast: vi.fn() }));
vi.mock('../components/LogPanel.js', () => ({ addLog: vi.fn() }));

const { default: SyncTab } = await import('./SyncTab');

const REPOS = [
  { id: 1, name: 'java-racingcar', status: 'active', syncMode: 'continuous', track: 'backend' },
  { id: 2, name: 'javascript-lotto', status: 'active', syncMode: 'continuous', track: null },
  { id: 3, name: 'java-chess', status: 'active', syncMode: 'once', track: 'backend' },
  { id: 4, name: 'old-mission', status: 'excluded', syncMode: 'continuous', track: 'backend' },
];

function mockApi(workspace: { blogSyncEnabled: boolean; profileRefreshEnabled: boolean }) {
  apiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return { id: 1, ...workspace };
    switch (path) {
      case '/admin/workspace':
        return { id: 1, cohortRules: {}, ...workspace };
      case '/admin/repos':
        return REPOS;
      case '/admin/status':
        return { lastProfileRefreshAt: null };
      default:
        return [];
    }
  });
}

function renderSyncTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SyncTab />
    </QueryClientProvider>,
  );
}

function scheduleCard(label: string) {
  return screen.getByText(label).parentElement!;
}

describe('SyncTab schedule status', () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it('should list only active continuous repos as continuous sync targets', async () => {
    mockApi({ blogSyncEnabled: true, profileRefreshEnabled: false });
    renderSyncTab();

    expect(await screen.findByText('javascript-lotto')).toBeInTheDocument();
    expect(within(scheduleCard('연속 싱크 대상 레포')).getByText('2개')).toBeInTheDocument();
    expect(screen.getByText('java-racingcar')).toBeInTheDocument();
    expect(screen.queryByText('java-chess')).not.toBeInTheDocument();
    expect(screen.queryByText('old-mission')).not.toBeInTheDocument();
    // 트랙이 없으면 대시로 표시
    expect(within(screen.getByText('javascript-lotto').closest('tr')!).getByText('—')).toBeInTheDocument();
  });

  it('should show whether blog sync and profile refresh are enabled', async () => {
    mockApi({ blogSyncEnabled: true, profileRefreshEnabled: false });
    renderSyncTab();

    await waitFor(() => expect(within(scheduleCard('블로그 RSS 자동 싱크')).getByText('활성')).toBeInTheDocument());
    expect(within(scheduleCard('프로필 자동 새로고침')).getByText('비활성')).toBeInTheDocument();
  });

  it('should save the blog auto-sync toggle to the workspace', async () => {
    mockApi({ blogSyncEnabled: false, profileRefreshEnabled: true });
    renderSyncTab();
    const checkbox = within(screen.getByText('블로그').parentElement!).getByRole('checkbox');
    await waitFor(() => expect(checkbox).not.toBeChecked());

    await userEvent.click(checkbox);

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/admin/workspace', {
        method: 'PUT',
        body: JSON.stringify({ blogSyncEnabled: true }),
      }),
    );
  });
});
