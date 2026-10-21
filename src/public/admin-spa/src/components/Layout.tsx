import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TabNav } from './TabNav.js';
import { statBadgeVariants } from './ui/StatCard.js';
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
    if (!githubStatus.ok) return <span className={statBadgeVariants({ tone: 'danger' })}>GitHub API 오류</span>;
    const tone = githubStatus.remaining < 100 ? 'caution' : 'success';
    return (
      <span className={statBadgeVariants({ tone })}>
        GitHub {githubStatus.remaining}/{githubStatus.limit}
      </span>
    );
  })();

  return (
    <div className="min-h-screen bg-base-50 flex flex-col">
      {/* 헤더와 탭은 화면 위에 고정 — 긴 표를 내려가도 탭을 바꿀 수 있다 */}
      <div className="sticky top-0 z-20">
        <header className="bg-white border-b border-base-200 px-4 md:px-6 py-3 flex items-center justify-between">
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
      </div>
      <main className="flex-1 p-4 md:p-6 pb-48">{children}</main>
      <LogPanel />
    </div>
  );
}
