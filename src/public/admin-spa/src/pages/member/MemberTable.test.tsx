import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Member } from '../../lib/types';

const apiFetch = vi.fn();
const showToast = vi.fn();
vi.mock('../../lib/api.js', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));
vi.mock('../../components/ui/Toast.js', () => ({ showToast: (...args: unknown[]) => showToast(...args) }));

const { MemberTable } = await import('./MemberTable');

function member(id: number, overrides: Partial<Member> = {}): Member {
  return {
    id,
    githubId: `crew${id}`,
    githubUserId: id,
    nickname: `닉${id}`,
    manualNickname: null,
    avatarUrl: null,
    blog: null,
    lastPostedAt: null,
    profileFetchedAt: null,
    profileRefreshError: null,
    rssStatus: null,
    rssUrl: null,
    rssCheckedAt: null,
    cohort: 8,
    cohorts: [{ cohort: 8, roles: ['crew'] }],
    roles: ['crew'],
    cohortLocked: false,
    track: null,
    tracks: [],
    blogPosts: [],
    submissions: [],
    _count: { submissions: 0, blogPosts: 0 },
    ...overrides,
  };
}

const MEMBERS = [
  member(1, { nickname: '가람', cohort: 7, _count: { submissions: 5, blogPosts: 1 } }),
  member(2, { nickname: '나래', cohort: 8, _count: { submissions: 2, blogPosts: 0 }, blog: 'https://b.example.com/' }),
  member(3, { nickname: '다솜', cohort: null, cohorts: [], _count: { submissions: 0, blogPosts: 3 } }),
];

const onRefresh = vi.fn();

function renderTable(members = MEMBERS) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemberTable members={members} onRefresh={onRefresh} />
    </QueryClientProvider>,
  );
}

const rowNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('button')[0].textContent);

const calls = (method?: string) =>
  apiFetch.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === method)
    .map(([path, init]) => [path, (init as RequestInit | undefined)?.body ?? null]);

describe('MemberTable', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    showToast.mockReset();
    onRefresh.mockReset();
    localStorage.clear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/admin/members/1')
        return {
          ...MEMBERS[0],
          submissions: [
            {
              id: 11,
              prNumber: 3,
              prUrl: 'https://github.com/x/pull/3',
              title: '1단계',
              status: 'merged',
              submittedAt: '2026-03-01T00:00:00.000Z',
              missionRepo: { name: 'java-racingcar' },
            },
          ],
        };
      if (path.endsWith('/blog-posts'))
        return {
          latest: [{ id: 21, url: 'https://b.example.com/1', title: '첫 글', publishedAt: '2026-03-02T00:00:00.000Z' }],
          archive: [],
        };
      if (path.endsWith('/resync-submissions')) return { totalSynced: 4 };
      return {};
    });
  });

  it('should sort by cohort descending with empty values last, then toggle by header', async () => {
    renderTable();
    expect(rowNames()).toEqual(['나래', '가람', '다솜']);

    await userEvent.click(screen.getByText(/^제출/));
    expect(rowNames()).toEqual(['다솜', '나래', '가람']);
    await userEvent.click(screen.getByText(/^제출/));
    expect(rowNames()).toEqual(['가람', '나래', '다솜']);
    expect(screen.getByText(/^제출/).textContent).toBe('제출 ↓');
  });

  it('should save a nickname on Enter and cancel on Escape', async () => {
    renderTable();
    await userEvent.click(screen.getByText('가람'));
    const input = screen.getByPlaceholderText('닉네임');
    expect(input).toHaveFocus();
    await userEvent.type(input, '수동{Escape}');
    expect(screen.queryByPlaceholderText('닉네임')).toBeNull();
    expect(calls('PATCH')).toEqual([]);

    await userEvent.click(screen.getByText('가람'));
    await userEvent.type(screen.getByPlaceholderText('닉네임'), '수동{Enter}');
    await waitFor(() => expect(calls('PATCH')).toEqual([['/admin/members/1', '{"manualNickname":"수동"}']]));
    await waitFor(() => expect(screen.queryByPlaceholderText('닉네임')).toBeNull());
    expect(showToast).toHaveBeenCalledWith('수정 완료');
    expect(onRefresh).toHaveBeenCalled();
  });

  it('should save the blog when clicking outside and the track as soon as it is picked', async () => {
    renderTable();
    await userEvent.click(screen.getByTitle('https://b.example.com/'));
    await userEvent.clear(screen.getByPlaceholderText('블로그 URL'));
    await userEvent.type(screen.getByPlaceholderText('블로그 URL'), 'https://new.example.com');
    await userEvent.click(document.body);
    await waitFor(() => expect(calls('PATCH')).toEqual([['/admin/members/2', '{"blog":"https://new.example.com"}']]));

    await userEvent.click(screen.getAllByTitle('트랙 편집')[0]);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'frontend');
    await waitFor(() => expect(calls('PATCH')).toContainEqual(['/admin/members/2', '{"track":"frontend"}']));
  });

  it('should edit cohorts and roles in the cohort modal with an empty input each time it opens', async () => {
    renderTable();
    await userEvent.click(screen.getAllByTitle('기수/역할 편집')[0]);
    const dialog = screen.getByText('crew2 기수/역할').closest('div')!.parentElement!;
    const input = within(dialog).getByPlaceholderText('예: 9');
    expect(input).toHaveValue(null);

    await userEvent.type(input, '9');
    await userEvent.click(within(dialog).getByRole('button', { name: '추가' }));
    await userEvent.click(within(dialog).getByRole('button', { name: '코치' }));
    await userEvent.click(within(dialog).getByTitle('기수 삭제'));
    await userEvent.click(within(dialog).getByTitle('잠금 설정'));

    await waitFor(() =>
      expect(calls('PATCH')).toEqual([
        ['/admin/members/2', '{"cohort":9}'],
        ['/admin/members/2', '{"cohort":8,"roles":["crew","coach"]}'],
        ['/admin/members/2', '{"cohortLocked":true}'],
      ]),
    );
    expect(calls('DELETE')).toEqual([['/admin/members/2/cohorts/8', null]]);
    await waitFor(() => expect(within(dialog).getByTitle('잠금 해제')).toBeInTheDocument());

    await userEvent.type(input, '1');
    await userEvent.click(screen.getByText('×'));
    await userEvent.click(screen.getAllByTitle('기수/역할 편집')[0]);
    expect(screen.getByPlaceholderText('예: 9')).toHaveValue(null);
  });

  it('should show saved roles in the cohort modal without reopening it', async () => {
    apiFetch.mockImplementation(async (path: string, init?: RequestInit) =>
      path === '/admin/members/2' && init?.method === 'PATCH'
        ? { ...MEMBERS[1], cohorts: [{ cohort: 8, roles: ['crew', 'coach'] }] }
        : {},
    );
    renderTable();
    await userEvent.click(screen.getAllByTitle('기수/역할 편집')[0]);
    const dialog = screen.getByText('crew2 기수/역할').closest('div')!.parentElement!;
    expect(within(dialog).getByRole('button', { name: '코치' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(within(dialog).getByRole('button', { name: '코치' }));

    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: '코치' })).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(within(dialog).getByRole('button', { name: '크루' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('should open submissions and blog posts, and delete a submission', async () => {
    renderTable();
    await userEvent.click(screen.getAllByTitle('PR 확인')[2]);
    expect(showToast).toHaveBeenCalledWith('제출 내역이 없습니다', 'error');

    await userEvent.click(screen.getAllByTitle('PR 확인')[1]);
    expect(await screen.findByText('#3 1단계')).toBeInTheDocument();
    expect(screen.getByText('가람 제출 내역')).toBeInTheDocument();
    await userEvent.click(screen.getByTitle('PR 삭제'));
    await waitFor(() => expect(screen.getByText('제출 내역 없음')).toBeInTheDocument());
    expect(calls('DELETE')).toEqual([['/admin/members/1/submissions/11', null]]);
    await userEvent.click(screen.getByText('×'));

    await userEvent.click(screen.getAllByTitle('블로그 글 보기')[0]);
    expect(await screen.findByText('첫 글')).toBeInTheDocument();
    expect(screen.getByText('crew2 블로그 포스트')).toBeInTheDocument();
  });

  it('should run row actions and lock profile refresh while cooling down', async () => {
    renderTable();
    const row = screen.getAllByRole('row')[2];
    await userEvent.click(within(row).getByTitle('프로필 새로고침'));
    await waitFor(() => expect(within(row).getByTitle('60초 후 가능')).toBeDisabled());
    await userEvent.click(within(row).getByTitle('PR 재수집'));
    await userEvent.click(within(row).getByTitle('기수 재계산'));
    await userEvent.click(within(row).getByTitle('삭제'));

    await waitFor(() =>
      expect(calls('POST').map(([p]) => p)).toEqual([
        '/admin/members/1/refresh-profile',
        '/admin/members/1/resync-submissions',
        '/admin/members/1/recalculate-cohorts',
      ]),
    );
    await waitFor(() => expect(calls('DELETE')).toEqual([['/admin/members/1', null]]));
    expect(showToast).toHaveBeenCalledWith('crew1 PR 재수집 완료 (4개)');
  });

  it('should show the empty state', () => {
    renderTable([]);
    expect(screen.getByText('멤버 없음')).toBeInTheDocument();
  });
});
