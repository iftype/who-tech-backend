import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TabNav } from './TabNav.js';
import { LogPanel } from './LogPanel.js';
import { useAuth } from '../context/AuthContext.js';

import { adminApi } from '../lib/admin-api.js';
import { queryKeys } from '../lib/query-keys.js';

declare const __APP_VERSION__: string;

export function Layout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();

  const { data: githubStatus } = useQuery({
    queryKey: queryKeys.githubStatus(),
    queryFn: () => adminApi.githubStatus(),
    refetchInterval: 30_000,
    staleTime: 30_000,
  });

  const githubBadge = (() => {
    if (!githubStatus) return null;
    if (!githubStatus.ok) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger-100 text-danger-600 font-medium">
          GitHub API 오류
        </span>
      );
    }
    if (githubStatus.remaining < 100) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-caution-100 text-caution-600 font-medium">
          GitHub {githubStatus.remaining}/{githubStatus.limit}
        </span>
      );
    }
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-success-100 text-success-600 font-medium">
        GitHub {githubStatus.remaining}/{githubStatus.limit}
      </span>
    );
  })();

  return (
    <div className="min-h-screen bg-base-50 flex flex-col">
      <header className="bg-white border-b border-base-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-base-900">who.tech 어드민</h1>
          <span className="text-[10px] text-base-400 bg-base-100 px-1.5 py-0.5 rounded">v{__APP_VERSION__}</span>
          {githubBadge}
        </div>
        <button onClick={logout} className="text-xs text-base-400 hover:text-base-600">
          로그아웃
        </button>
      </header>
      <TabNav />
      <main className="flex-1 p-6 pb-48">{children}</main>
      <LogPanel />
    </div>
  );
}
