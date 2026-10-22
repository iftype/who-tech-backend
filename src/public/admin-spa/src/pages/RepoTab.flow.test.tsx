import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MissionRepo, SyncJob } from '../lib/types';

// 확인 창은 ConfirmDialog.test가 따로 검사한다. 여기서는 항상 '확인'
vi.mock('../components/ui/ConfirmDialog.js', () => ({ confirmAction: vi.fn(async () => true) }));

// 레포 관리 흐름: 칸 편집, 모드 전환·삭제·초기화, 레포별 싱크 진행(폴링), base 전체 싱크, 선택·일괄 변경
const apiFetch = vi.fn();
const showToast = vi.fn();
const addLog = vi.fn();
const polls = new Map<string, (job: SyncJob) => void>();
const stopped: string[] = [];
vi.mock('../lib/api.js', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  pollSyncJob: (jobId: string, onUpdate: (job: SyncJob) => void) => {
    polls.set(jobId, onUpdate);
    return () => stopped.push(jobId);
  },
}));
vi.mock('../components/ui/Toast.js', () => ({ showToast: (...args: unknown[]) => showToast(...args) }));
vi.mock('../components/LogPanel.js', () => ({ addLog: (...args: unknown[]) => addLog(...args) }));

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
  repo(1, { name: 'java-racingcar', cohorts: [8, 7] }),
  repo(2, { name: 'java-lotto', status: 'candidate', tabCategory: 'common', description: '로또' }),
  repo(3, { name: 'javascript-lotto', syncMode: 'once', track: 'frontend' }),
  repo(4, { name: 'java-chess' }),
];

function job(id: string, repoId: number, status: SyncJob['status'], percent = 0): SyncJob {
  return {
    id,
    repoId,
    repoName: '',
    status,
    message: status === 'failed' ? '실패 메시지' : '',
    startedAt: '',
    finishedAt: null,
    progress: { total: 10, processed: percent / 10, synced: 3, percent, phase: '수집' },
    result: { synced: 3 },
  } as SyncJob;
}

function renderRepoTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RepoTab />
    </QueryClientProvider>,
  );
}

const writes = () =>
  apiFetch.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method)
    .map(([path, init]) => [(init as RequestInit).method, path, (init as RequestInit).body ?? null]);
const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr')!;

describe('RepoTab flow', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    showToast.mockReset();
    addLog.mockReset();
    polls.clear();
    stopped.length = 0;
    apiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      const sync = /^\/admin\/repos\/(\d+)\/sync$/.exec(path);
      if (sync) return job(`job-${sync[1]}`, Number(sync[1]), 'queued');
      if (path === '/admin/repos/discover') return { discovered: 3, created: 1, updated: 2 };
      if (path === '/admin/sync/continuous') return { totalSynced: 5, reposSynced: 2 };
      if (init?.method) return {};
      if (path.startsWith('/admin/repos')) return REPOS;
      return [];
    });
  });

  it('should edit cells and skip saving unchanged or invalid values', async () => {
    renderRepoTab();
    const row = await rowOf('java-racingcar');

    await userEvent.click(within(row).getByText('backend'));
    await userEvent.selectOptions(within(row).getByRole('combobox'), 'frontend');
    await waitFor(() => expect(writes()).toEqual([['PATCH', '/admin/repos/1', '{"track":"frontend"}']]));
    await waitFor(() => expect(within(row).queryByRole('combobox')).toBeNull());

    await userEvent.click(within(row).getByText('8, 7'));
    await userEvent.keyboard('{Enter}');
    expect(writes()).toHaveLength(1);

    await userEvent.click(within(row).getByText('8, 7'));
    await userEvent.keyboard('{Control>}a{/Control}6, x{Enter}');
    expect(showToast).toHaveBeenCalledWith('쉼표로 구분된 숫자를 입력하세요', 'error');
    expect(writes()).toHaveLength(1);

    await userEvent.click(within(row).getByText('8, 7'));
    await userEvent.keyboard('{Control>}a{/Control}9, 8{Enter}');
    await waitFor(() => expect(writes()).toContainEqual(['PATCH', '/admin/repos/1', '{"cohorts":[9,8]}']));

    const lotto = await rowOf('java-lotto');
    await userEvent.click(within(lotto).getByText('로또'));
    await userEvent.keyboard('{Control>}a{/Control}새 설명{Escape}');
    await userEvent.click(within(lotto).getByText('공통'));
    await userEvent.selectOptions(within(lotto).getByRole('combobox'), 'precourse');
    await waitFor(() => expect(writes()).toContainEqual(['PATCH', '/admin/repos/2', '{"tabCategory":"precourse"}']));
  });

  it('should toggle mode, reset last sync, and delete', async () => {
    renderRepoTab();
    const row = await rowOf('javascript-lotto');
    await userEvent.click(within(row).getByRole('button', { name: '1회' }));
    await userEvent.click(within(row).getByRole('button', { name: '초기화' }));
    await userEvent.click(within(row).getByRole('button', { name: '삭제' }));
    await waitFor(() =>
      expect(writes()).toEqual([
        ['PATCH', '/admin/repos/3', '{"syncMode":"continuous"}'],
        ['PATCH', '/admin/repos/3', '{"lastSyncAt":null}'],
        ['DELETE', '/admin/repos/3', null],
      ]),
    );
    expect(showToast).toHaveBeenCalledWith('lastSyncAt 초기화 완료');
    expect(showToast).toHaveBeenCalledWith('삭제 완료');
  });

  it('should follow a repo sync until it completes and block bulk syncs meanwhile', async () => {
    renderRepoTab();
    const row = await rowOf('java-racingcar');
    await userEvent.click(within(row).getByRole('button', { name: '싱크' }));
    await waitFor(() => expect(polls.has('job-1')).toBe(true));
    expect(within(row).getByRole('button', { name: '...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Base 전체 싱크' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '연속 싱크' })).toBeDisabled();

    act(() => polls.get('job-1')!(job('job-1', 1, 'running', 40)));
    expect(addLog).toHaveBeenCalledWith('run', '[java-racingcar] 40% — 수집');
    act(() => polls.get('job-1')!(job('job-1', 1, 'completed', 100)));
    expect(addLog).toHaveBeenCalledWith('ok', '[java-racingcar] 싱크 완료 (3건)');
    expect(showToast).toHaveBeenCalledWith('java-racingcar 싱크 완료');
    expect(within(row).getByRole('button', { name: '싱크' })).toBeEnabled();

    await userEvent.click(within(await rowOf('java-chess')).getByRole('button', { name: '싱크' }));
    await waitFor(() => expect(polls.has('job-4')).toBe(true));
    act(() => polls.get('job-4')!(job('job-4', 4, 'failed')));
    expect(addLog).toHaveBeenCalledWith('err', '[java-chess] 싱크 실패: 실패 메시지');
    expect(showToast).toHaveBeenCalledWith('java-chess 싱크 실패', 'error');
  });

  it('should tell the continuous sync is still queued when the server answers with the job', async () => {
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/admin/sync/continuous') return { id: 'job-9', type: 'continuous', status: 'queued' };
      if (path.startsWith('/admin/repos')) return REPOS;
      return [];
    });
    renderRepoTab();
    await screen.findByText('java-racingcar');

    await userEvent.click(screen.getByRole('button', { name: '연속 싱크' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('연속 싱크가 큐에서 실행 대기 중입니다 — 싱크 탭에서 확인하세요'),
    );
  });

  it('should sync all active base repos, discover, and run continuous sync', async () => {
    const { unmount } = renderRepoTab();
    await screen.findByText('java-racingcar');
    await userEvent.click(screen.getByRole('button', { name: '레포 탐색' }));
    await userEvent.click(screen.getByRole('button', { name: '연속 싱크' }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('연속 싱크 완료 — 5건, 2개 레포'));
    expect(showToast).toHaveBeenCalledWith('탐색 완료 — 3개 발견, 1개 생성, 2개 갱신');

    await userEvent.click(screen.getByRole('button', { name: 'Base 전체 싱크' }));
    await waitFor(() => expect(addLog).toHaveBeenCalledWith('ok', '[Batch] base 전체 싱크 완료 — 3개'));
    expect(addLog).toHaveBeenCalledWith('info', '[Batch] base 전체 싱크 시작 — 3개');
    expect([...polls.keys()]).toEqual(['job-1', 'job-3', 'job-4']);
    unmount();
    expect(stopped.sort()).toEqual(['job-1', 'job-3', 'job-4']);
  });

  it('should select repos and change their track at once', async () => {
    renderRepoTab();
    await screen.findByText('java-racingcar');
    const [continuousAll] = screen.getAllByRole('checkbox');
    await userEvent.click(continuousAll);
    expect(screen.getByText('3개 선택됨')).toBeInTheDocument();
    await userEvent.click(within(await rowOf('java-lotto')).getByRole('checkbox'));
    expect(screen.getByText('2개 선택됨')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByDisplayValue('공통'), 'android');
    await userEvent.click(screen.getByRole('button', { name: '일괄 변경' }));
    await waitFor(() =>
      expect(writes()).toEqual([
        ['PATCH', '/admin/repos/1', '{"track":"android"}'],
        ['PATCH', '/admin/repos/4', '{"track":"android"}'],
      ]),
    );
    await waitFor(() => expect(screen.queryByText(/개 선택됨/)).toBeNull());

    await userEvent.click(continuousAll);
    await userEvent.click(continuousAll);
    expect(screen.queryByText(/개 선택됨/)).toBeNull();
    await userEvent.click(continuousAll);
    await userEvent.click(screen.getByRole('button', { name: '선택 해제' }));
    expect(screen.queryByText(/개 선택됨/)).toBeNull();
  });
});
