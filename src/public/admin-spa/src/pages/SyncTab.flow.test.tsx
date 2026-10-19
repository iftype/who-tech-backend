import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeEventSource } from '../test/fake-event-source';

// 싱크 탭 전체 흐름: 상태 카드, 작업 큐 추가와 진행 로그(SSE), 취소, 테코톡·블로그 실행
const apiFetch = vi.fn();
const showToast = vi.fn();
vi.mock('../lib/api.js', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  pollSyncJob: vi.fn(() => () => {}),
}));

const sources: FakeEventSource[] = [];
vi.mock('../lib/sse.js', () => ({
  createEventSource: (url: string) => {
    const es = new FakeEventSource(url);
    sources.push(es);
    return es;
  },
}));
vi.mock('../components/ui/Toast.js', () => ({ showToast: (...args: unknown[]) => showToast(...args) }));
vi.mock('../components/LogPanel.js', () => ({ addLog: vi.fn() }));
vi.stubGlobal('EventSource', FakeEventSource);
Element.prototype.scrollIntoView = vi.fn();

const { default: SyncTab } = await import('./SyncTab');

const QUEUE = [
  {
    id: 'q-run',
    type: 'cohort-repos',
    cohort: 8,
    status: 'running',
    createdAt: '2026-10-01T00:00:00.000Z',
    startedAt: '2026-10-01T00:01:00.000Z',
    progress: { repo: 'java-chess', done: 2, total: 5, synced: 1 },
  },
  {
    id: 'q-old',
    type: 'workspace',
    status: 'completed',
    createdAt: '2026-09-01T00:00:00.000Z',
    completedAt: '2026-09-01T00:10:00.000Z',
    result: { totalSynced: 7, reposSynced: 2 },
  },
];

function mockApi() {
  apiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/admin/sync/jobs' && init?.method === 'POST') return { id: 'job-1', status: 'queued', createdAt: '' };
    if (path.startsWith('/admin/tecotalk/sync')) return { total: 4, matched: 2, ambiguous: 1, unmatched: 1 };
    if (init?.method) return {};
    switch (path) {
      case '/admin/status':
        return {
          ok: true,
          memberCount: 123,
          activeRepoCount: 45,
          lastSyncAt: null,
          profileRefreshEnabled: false,
          lastProfileRefreshAt: null,
        };
      case '/admin/github-status':
        return { ok: true, remaining: 50, limit: 5000, resetAt: null };
      case '/admin/workspace':
        return { id: 1, cohortRules: {}, blogSyncEnabled: true, profileRefreshEnabled: false };
      case '/admin/tecotalk':
        return [
          { id: 1, title: '최신 발표', uploadedAt: '2026-10-01T00:00:00.000Z', matchStatus: 'matched' },
          { id: 2, title: '옛 발표', uploadedAt: '2026-09-01T00:00:00.000Z', matchStatus: 'unmatched' },
        ];
      case '/admin/sync/jobs':
        return QUEUE;
      case '/admin/repos/sync-jobs':
        return [
          {
            id: 'r1',
            status: 'completed',
            message: '레포 완료',
            startedAt: '2026-09-15T00:00:00.000Z',
            finishedAt: null,
            repoName: 'java-lotto',
          },
        ];
      case '/admin/blog/sync-jobs':
        return [
          {
            id: 'b1',
            status: 'failed',
            message: '블로그 실패',
            startedAt: '2026-08-01T00:00:00.000Z',
            finishedAt: null,
            source: 'manual',
          },
        ];
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

const posts = () =>
  apiFetch.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method && (init as RequestInit).method !== 'GET')
    .map(([path, init]) => [(init as RequestInit).method, path, (init as RequestInit).body ?? null]);
const statusReads = () => apiFetch.mock.calls.filter(([path, init]) => path === '/admin/status' && !init).length;

describe('SyncTab flow', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    showToast.mockReset();
    sources.length = 0;
    mockApi();
  });

  it('should show status cards, the latest tecotalk, active jobs and recent jobs newest first', async () => {
    renderSyncTab();
    expect(await screen.findByText('123')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(await screen.findByText('50/5000')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText(/최신 업로드: 최신 발표/)).toBeInTheDocument();
    expect(await screen.findByText('현재 싱크 작업 (1)')).toBeInTheDocument();
    expect(screen.getByText('java-chess (2/5)')).toBeInTheDocument();
    expect(screen.getByText('기수레포 (8기)')).toBeInTheDocument();
    // 최근 작업은 완료(없으면 시작) 시각 최신순. 블로그 작업은 종류·메시지를 그대로 보여 준다
    const recent = (await screen.findByText('최근 싱크 작업 (3)')).parentElement!;
    const rows = within(recent).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.lastElementChild?.textContent)).toEqual([
      'java-lotto — 레포 완료',
      '✓ 7개',
      '블로그 실패',
    ]);
    expect(within(rows[2]!).getByText('블로그')).toBeInTheDocument();
  });

  it('should enqueue a cohort sync, stream its logs, and refresh status when done', async () => {
    renderSyncTab();
    await screen.findByText('123');
    expect(screen.getByRole('button', { name: '기수 레포 업데이트' })).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText('예: 9'), '9');
    await userEvent.click(screen.getByRole('button', { name: '9기 싱크' }));
    await waitFor(() => expect(sources).toHaveLength(1));
    expect(sources[0].url).toBe('/admin/sync/jobs/job-1/stream');
    expect(posts()).toContainEqual(['POST', '/admin/sync/jobs', '{"type":"workspace","cohort":9}']);
    expect(await screen.findByText('작업 job-1 시작 대기 중')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('예: 9')).toBeDisabled();
    expect(screen.getByRole('button', { name: '중단' })).toBeInTheDocument();

    act(() => sources[0].emit('progress', { repo: 'java-lotto', message: '수집', percent: 50 }));
    expect(await screen.findByText('java-lotto · 수집 · 50%')).toBeInTheDocument();
    act(() => sources[0].emit('progress', 'not json'));
    expect(await screen.findByText('not json')).toBeInTheDocument();

    const before = statusReads();
    act(() => sources[0].emit('done', { message: '9기 완료' }));
    expect(await screen.findByText('9기 완료')).toBeInTheDocument();
    expect(sources[0].closed).toBe(true);
    expect(screen.queryByRole('button', { name: '중단' })).toBeNull();
    await waitFor(() => expect(statusReads()).toBeGreaterThan(before));

    await userEvent.click(screen.getByRole('button', { name: '기수 레포 업데이트' }));
    await userEvent.click(screen.getByRole('button', { name: '연속 싱크' }));
    await waitFor(() => expect(sources).toHaveLength(3));
    expect(posts()).toContainEqual(['POST', '/admin/sync/jobs', '{"type":"cohort-repos","cohort":9}']);
    expect(posts()).toContainEqual(['POST', '/admin/sync/jobs', '{"type":"continuous"}']);
    // 새 작업을 넣으면 이전 로그는 지운다
    expect(screen.queryByText('9기 완료')).toBeNull();

    act(() => sources[2].emit('error', 'broken'));
    expect(await screen.findByText('연결 오류')).toBeInTheDocument();
  });

  it('should stop following a job without cancelling it', async () => {
    renderSyncTab();
    await screen.findByText('123');
    await userEvent.click(screen.getByRole('button', { name: '전체 싱크' }));
    await userEvent.click(await screen.findByRole('button', { name: '중단' }));
    expect(sources[0].closed).toBe(true);
    expect(posts().filter(([m]) => m === 'DELETE')).toEqual([]);
  });

  it('should cancel a queued job and run tecotalk, blog and profile jobs', async () => {
    renderSyncTab();
    const active = (await screen.findByText('현재 싱크 작업 (1)')).parentElement!;
    await userEvent.click(within(active).getByRole('button', { name: '취소' }));
    await userEvent.click(screen.getByRole('button', { name: '증분 싱크' }));
    await userEvent.click(screen.getByRole('button', { name: '전체 재매칭' }));
    await userEvent.click(screen.getByRole('button', { name: 'RSS 전체 싱크' }));
    await userEvent.click(screen.getByRole('button', { name: '프로필 전체 새로고침' }));
    await userEvent.click(screen.getByRole('checkbox', { name: '자동 새로고침' }));

    await waitFor(() =>
      expect(posts()).toEqual([
        ['DELETE', '/admin/sync/jobs/q-run', null],
        ['POST', '/admin/tecotalk/sync', null],
        ['POST', '/admin/tecotalk/sync?mode=full', null],
        ['POST', '/admin/blog/sync', null],
        ['POST', '/admin/members/refresh-profiles', null],
        ['PUT', '/admin/workspace', '{"profileRefreshEnabled":true}'],
      ]),
    );
    expect(showToast).toHaveBeenCalledWith('작업이 취소되었습니다');
    expect(showToast).toHaveBeenCalledWith('테코톡 싱크 완료 — 2/4 매칭, ambiguous 1, unmatched 1');
  });
});
