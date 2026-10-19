import { useQuery } from '@tanstack/react-query';

import type { RecentSyncJob, SyncQueueJob } from '../../lib/types.js';
import { adminApi } from '../../lib/admin-api.js';
import { queryKeys } from '../../lib/query-keys.js';

// 싱크 탭이 보여 주는 서버 상태. 작업이 돌고 있으면(running) 작업 목록을 더 자주 다시 읽는다
export function useSyncDashboard(running: boolean) {
  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: queryKeys.adminStatus(),
    queryFn: () => adminApi.status(),
    staleTime: 60_000,
  });

  const { data: workspace } = useQuery({
    queryKey: queryKeys.workspace(),
    queryFn: () => adminApi.workspace.get(),
    staleTime: 300_000,
  });

  const { data: githubStatus } = useQuery({
    queryKey: queryKeys.githubStatus(),
    queryFn: () => adminApi.githubStatus(),
    refetchInterval: 30_000,
    staleTime: 30_000,
  });

  const { data: repos = [] } = useQuery({
    queryKey: queryKeys.repos.syncSchedule(),
    queryFn: () => adminApi.repos.list(),
  });

  const { data: tecoTalks = [] } = useQuery({
    queryKey: queryKeys.tecotalkSyncStatus(),
    queryFn: () => adminApi.tecotalk.list(),
    staleTime: 30_000,
  });

  const { data: repoJobs = [] } = useQuery({
    queryKey: queryKeys.repos.syncJobs(),
    queryFn: () => adminApi.repos.syncJobs(),
    staleTime: 10_000,
    refetchInterval: running ? 2000 : 10_000,
  });

  const { data: blogJobs = [] } = useQuery({
    queryKey: queryKeys.blog.syncJobs(),
    queryFn: () => adminApi.blog.syncJobs(),
    staleTime: 10_000,
    refetchInterval: running ? 2000 : 10_000,
  });

  const { data: queueJobs = [] } = useQuery({
    queryKey: queryKeys.syncQueueJobs(),
    queryFn: () => adminApi.sync.jobs(),
    staleTime: 0,
    refetchInterval: 3000,
  });

  const recentQueueJobs = queueJobs.filter(
    (j) => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled',
  );
  const recentJobs = [...recentQueueJobs, ...repoJobs, ...blogJobs].sort((a, b) => {
    const aDate = new Date((a as SyncQueueJob).completedAt ?? (a as RecentSyncJob).startedAt ?? 0);
    const bDate = new Date((b as SyncQueueJob).completedAt ?? (b as RecentSyncJob).startedAt ?? 0);
    return bDate.getTime() - aDate.getTime();
  });

  return {
    status,
    refetchStatus,
    workspace,
    githubStatus,
    continuousRepos: repos.filter((r) => r.status === 'active' && r.syncMode === 'continuous'),
    tecoTalks,
    activeQueueJobs: queueJobs.filter((j) => j.status === 'queued' || j.status === 'running'),
    recentJobs,
  };
}
