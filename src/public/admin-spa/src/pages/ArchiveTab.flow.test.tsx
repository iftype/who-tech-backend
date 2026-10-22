import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeEventSource } from '../test/fake-event-source';
import type { CohortRepo } from '../lib/types';

// 확인 창은 ConfirmDialog.test가 따로 검사한다. 여기서는 항상 '확인'
vi.mock('../components/ui/ConfirmDialog.js', () => ({ confirmAction: vi.fn(async () => true) }));

// 기수별 레포 관리 흐름: 목록·레벨 묶음, 순서·레벨 편집, 추가·삭제·자동 채우기, 목록 재수집 로그
const apiFetch = vi.fn();
const showToast = vi.fn();
vi.mock('../lib/api.js', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));
const sources: FakeEventSource[] = [];
vi.mock('../lib/sse.js', () => ({
  createEventSource: (url: string) => {
    const es = new FakeEventSource(url);
    sources.push(es);
    return es;
  },
}));
vi.mock('../components/ui/Toast.js', () => ({ showToast: (...args: unknown[]) => showToast(...args) }));
vi.stubGlobal('EventSource', FakeEventSource);
Element.prototype.scrollIntoView = vi.fn();

const { default: ArchiveTab } = await import('./ArchiveTab');

function cohortRepo(
  id: number,
  name: string,
  overrides: Partial<CohortRepo> = {},
  tabCategory = 'base',
  track: string | null = 'backend',
): CohortRepo {
  return {
    id,
    cohort: 8,
    order: id,
    level: 1,
    missionRepoId: 100 + id,
    missionRepo: { id: 100 + id, name, repoUrl: `https://github.com/woowacourse/${name}`, track, tabCategory },
    ...overrides,
  };
}

const COHORT_REPOS = [
  cohortRepo(1, 'java-racingcar'),
  cohortRepo(2, 'javascript-lotto', { level: 2 }, 'base', 'frontend'),
  cohortRepo(3, 'tecoble', { level: null }, 'common', null),
];
const ALL_REPOS = [
  { id: 101, name: 'java-racingcar', track: 'backend' },
  { id: 201, name: 'java-chess', track: 'backend' },
  { id: 202, name: 'react-shopping', track: 'frontend' },
];

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ArchiveTab />
    </QueryClientProvider>,
  );
}

const writes = () =>
  apiFetch.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method)
    .map(([path, init]) => [(init as RequestInit).method, path, (init as RequestInit).body ?? null]);

const last = <T,>(items: T[]) => items[items.length - 1];

async function chooseCohort() {
  renderTab();
  await userEvent.type(screen.getByPlaceholderText('예: 8'), '8');
  await screen.findByText('레벨별 레포');
}

describe('ArchiveTab flow', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    showToast.mockReset();
    sources.length = 0;
    apiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/admin/cohort-repos/auto-fill') return { added: 2 };
      if (init?.method) return {};
      if (path === '/admin/cohort-repos?cohort=8') return COHORT_REPOS;
      if (path === '/admin/repos') return ALL_REPOS;
      return [];
    });
  });

  it('should list track and common missions, then group them by level', async () => {
    await chooseCohort();
    expect(screen.getByText('(3개)')).toBeInTheDocument();
    expect(screen.getByText('트랙 미션')).toBeInTheDocument();
    expect(screen.getByText('공통 미션')).toBeInTheDocument();
    const groups = screen.getAllByText(/^(Lv \d+|미분류)/).map((el) => el.textContent);
    expect(groups).toEqual(['Lv 1(1개)', 'Lv 2(1개)', '미분류(1개)']);
    expect(screen.getAllByText('java-racingcar')).toHaveLength(2);

    await userEvent.selectOptions(screen.getByDisplayValue('전체'), 'frontend');
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('기수별 레포 순서 (1개)');
    expect(screen.queryByText('공통 미션')).toBeNull();
    expect(screen.queryByText('java-racingcar')).toBeNull();
  });

  it('should edit order and level in place', async () => {
    await chooseCohort();
    await userEvent.click(screen.getAllByTitle('클릭하여 순서 변경')[0]);
    const orderInputs = screen.getAllByDisplayValue('1');
    // 같은 레포가 두 표에 나오면 마지막(레벨별 표) 입력칸에 초점이 간다
    await waitFor(() => expect(orderInputs[orderInputs.length - 1]).toHaveFocus());
    // 값이 그대로면 저장하지 않고 편집만 닫는다
    await userEvent.keyboard('{Enter}');
    expect(writes()).toEqual([]);
    expect(screen.queryAllByDisplayValue('1')).toHaveLength(0);

    await userEvent.click(screen.getAllByTitle('클릭하여 순서 변경')[0]);
    await waitFor(() => expect(last(screen.getAllByDisplayValue('1'))).toHaveFocus());
    await userEvent.clear(last(screen.getAllByDisplayValue('1')));
    await userEvent.keyboard('5{Enter}');
    await waitFor(() => expect(writes()).toEqual([['PATCH', '/admin/cohort-repos/1', '{"order":5}']]));

    await userEvent.click(screen.getAllByTitle('클릭하여 레벨 변경')[1]);
    await waitFor(() => expect(last(screen.getAllByDisplayValue('2'))).toHaveFocus());
    await userEvent.clear(last(screen.getAllByDisplayValue('2')));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(writes()).toContainEqual(['PATCH', '/admin/cohort-repos/2', '{"level":null}']));

    await userEvent.click(screen.getAllByTitle('클릭하여 레벨 변경')[0]);
    await waitFor(() => expect(last(screen.getAllByDisplayValue('1'))).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryAllByDisplayValue('1')).toHaveLength(0);
    expect(writes()).toHaveLength(2);
  });

  it('should add, delete and auto-fill cohort repos', async () => {
    await chooseCohort();
    expect(screen.getByText('레포 선택 (2개)')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('레포 검색...'), 'front');
    expect(screen.getByText('레포 선택 (1개)')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByDisplayValue('레포 선택 (1개)'), '202');
    await userEvent.click(screen.getByRole('button', { name: '추가' }));
    await waitFor(() =>
      expect(writes()).toEqual([['POST', '/admin/cohort-repos', '{"cohort":8,"missionRepoId":202}']]),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: '추가' })).toBeDisabled());

    await userEvent.click(screen.getAllByTitle('삭제')[0]);
    await userEvent.click(screen.getByRole('button', { name: '자동 채우기' }));
    await waitFor(() =>
      expect(writes().slice(1)).toEqual([
        ['DELETE', '/admin/cohort-repos/1', null],
        ['POST', '/admin/cohort-repos/auto-fill', '{"cohort":8}'],
      ]),
    );
    expect(showToast).toHaveBeenCalledWith('2개 레포 자동 추가 완료');
  });

  it('should stream the cohort repo resync log and stop', async () => {
    await chooseCohort();
    const table = screen.getByText('트랙 미션').parentElement!;
    expect(within(table).getAllByRole('row')).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: '목록 전체 재 Sync' }));
    expect(sources[0].url).toBe('/admin/sync/cohort-repos/stream?cohort=8');
    expect(screen.getByText('기수 레포 업데이트 시작')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '싱크 중...' })).toBeDisabled();
    act(() => sources[0].emit('progress', { repo: 'java-chess', count: 3 }));
    expect(await screen.findByText('java-chess · 3건')).toBeInTheDocument();
    act(() => sources[0].emit('error', { message: '권한 없음' }));
    expect(await screen.findByText('권한 없음')).toBeInTheDocument();
    expect(sources[0].closed).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: '목록 전체 재 Sync' }));
    expect(screen.queryByText('권한 없음')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '중단' }));
    expect(sources[1].closed).toBe(true);
    expect(screen.getByRole('button', { name: '목록 전체 재 Sync' })).toBeEnabled();
  });
});
