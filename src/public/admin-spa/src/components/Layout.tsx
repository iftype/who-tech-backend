import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import TabNav from './TabNav.js';
import LogPanel from './LogPanel.js';
import { useAuth } from '../context/AuthContext.js';
import { apiFetch } from '../lib/api.js';
import type { GithubStatus } from '../lib/types.js';

declare const __APP_VERSION__: string;

export default function Layout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();

  const { data: githubStatus } = useQuery({
    queryKey: ['github-status'],
    queryFn: () => apiFetch<GithubStatus>('/admin/github-status'),
    refetchInterval: 30_000,
    staleTime: 30_000,
  });

  const githubBadge = (() => {
    if (!githubStatus) return null;
    if (!githubStatus.ok) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">
          GitHub API 오류
        </span>
      );
    }
    if (githubStatus.remaining < 100) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-medium">
          GitHub {githubStatus.remaining}/{githubStatus.limit}
        </span>
      );
    }
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-600 font-medium">
        GitHub {githubStatus.remaining}/{githubStatus.limit}
      </span>
    );
  })();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-gray-900">who.tech 어드민</h1>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">v{__APP_VERSION__}</span>
          {githubBadge}
        </div>
        <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600">
          로그아웃
        </button>
      </header>
      <TabNav />
      <main className="flex-1 p-6 pb-48">{children}</main>
      <LogPanel />
    </div>
  );
}
