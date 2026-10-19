import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { showToast } from './components/ui/Toast';

// 앱 뼈대의 기능: 토스트가 실제로 보이는지, 세션이 끝나면 로그인 화면으로 돌아가는지
const fetchMock = vi.fn();

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('__APP_VERSION__', 'test');
  window.location.hash = '';
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('should show a toast and hide it after 3 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderApp();

    act(() => showToast('저장 완료'));
    expect(await screen.findByText('저장 완료')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(screen.queryByText('저장 완료')).not.toBeInTheDocument();
  });

  it('should go back to the login page when the server says the session expired', async () => {
    localStorage.setItem('admin_token', 'expired');
    fetchMock.mockImplementation(async () => json(401, { error: 'Unauthorized' }));

    renderApp();

    expect(await screen.findByPlaceholderText('Admin Secret')).toBeInTheDocument();
    expect(screen.queryByText('로그아웃')).not.toBeInTheDocument();
    expect(localStorage.getItem('admin_token')).toBeNull();
  });

  it('should stay on the login page with an error for a wrong secret', async () => {
    fetchMock.mockImplementation(async () => json(401, { error: 'Unauthorized' }));
    renderApp();

    await userEvent.type(screen.getByPlaceholderText('Admin Secret'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('인증 실패. 토큰을 확인하세요.')).toBeInTheDocument();
    expect(screen.queryByText('로그아웃')).not.toBeInTheDocument();
    expect(localStorage.getItem('admin_token')).toBeNull();
  });

  it('should enter the admin with the right secret', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/admin/status')) return json(200, { memberCount: 0, repoCount: 0, lastSyncAt: null });
      return json(200, []);
    });
    renderApp();

    await userEvent.type(screen.getByPlaceholderText('Admin Secret'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => expect(screen.getByText('로그아웃')).toBeInTheDocument());
    expect(localStorage.getItem('admin_token')).toBe('secret');
  });
});
