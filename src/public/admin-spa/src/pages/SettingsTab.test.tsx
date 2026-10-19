import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 설정 탭: 실패한 저장의 토스트가 MutationCache(meta.errorMessage)에서 뜨는지 화면 단위로 확인
const apiFetch = vi.fn();
const showToast = vi.fn();
vi.mock('../lib/api.js', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args), UNAUTHORIZED_EVENT: 'x' }));
vi.mock('../components/ui/Toast.js', () => ({ showToast: (...args: unknown[]) => showToast(...args) }));

const { default: SettingsTab } = await import('./SettingsTab');
const { createAdminQueryClient } = await import('../lib/query-client');

function renderTab() {
  return render(
    <QueryClientProvider client={createAdminQueryClient({ retry: false })}>
      <SettingsTab />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  showToast.mockReset();
  apiFetch.mockReset();
  apiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/admin/workspace') return { cohortRules: [], blogSyncEnabled: true };
    if (path === '/admin/banned-words' && init?.method === 'POST') throw new Error('409: 이미 등록된 금지어');
    if (path === '/admin/ignored-domains' && init?.method === 'POST') throw 'network down';
    return [];
  });
});

describe('SettingsTab', () => {
  it('should show the server message when adding a banned word fails', async () => {
    renderTab();
    await userEvent.type(await screen.findByPlaceholderText('추가할 금지어'), '빌리');
    await userEvent.click(screen.getAllByRole('button', { name: '추가' })[0]!);

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('409: 이미 등록된 금지어', 'error'));
  });

  it('should fall back to the screen message when the error has no message', async () => {
    renderTab();
    const input = await screen.findByPlaceholderText('예: example.com');
    await userEvent.type(input, 'example.com');
    await userEvent.click(screen.getAllByRole('button', { name: '추가' })[1]!);

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('추가 실패', 'error'));
  });
});
