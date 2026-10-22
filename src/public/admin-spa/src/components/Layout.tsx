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
    <div className="min-h-screen bg-base-50 md:flex">
      {/* 대시보드 사이드바(넓은 화면) / 위쪽 고정 바(좁은 화면). 긴 표를 내려가도 내비가 남는다 */}
      <aside className="sticky top-0 z-20 border-b border-base-200 bg-white md:flex md:h-screen md:w-52 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-3 md:py-4">
          <h1 className="text-sm font-semibold text-base-900">who.tech 어드민</h1>
          <button onClick={logout} className="text-xs text-base-400 hover:text-base-600">
            로그아웃
          </button>
        </div>
        <TabNav />
        {/* 상태 정보는 사이드바 아래로 — 모든 화면 위에서 시선을 뺏지 않게 */}
        <div className="mt-auto hidden space-y-1.5 border-t border-base-200 px-4 py-3 md:block">
          {githubBadge}
          <p className="text-2xs text-base-400">v{__APP_VERSION__}</p>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 pb-16 md:p-6 md:pb-16">{children}</main>
      <LogPanel />
    </div>
  );
}
