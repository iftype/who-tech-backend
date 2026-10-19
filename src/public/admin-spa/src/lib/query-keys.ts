// React Query 키를 한곳에서 만든다 (ARCHITECTURE_PLAN D-1). invalidateQueries는 앞부분이 같은 키를 함께 무효화하므로
// (예: repos.all()이 repos.byStatus(...)까지) 키 값을 바꾸면 갱신이 어긋난다
export const queryKeys = {
  adminStatus: () => ['admin-status'] as const,
  githubStatus: () => ['github-status'] as const,
  workspace: () => ['workspace'] as const,
  members: {
    all: () => ['members'] as const,
    list: (filters: unknown) => ['members', filters] as const,
    prs: () => ['members', 'prs'] as const,
    personLink: () => ['members', 'person-link'] as const,
    detail: (id: number | null) => ['member-detail', id] as const,
    cohorts: () => ['member-cohorts'] as const,
  },
  repos: {
    all: () => ['repos'] as const,
    byStatus: (status: string) => ['repos', status] as const,
    syncSchedule: () => ['repos', 'sync-schedule'] as const,
    syncJobs: () => ['repo-sync-jobs'] as const,
  },
  cohortRepos: {
    all: () => ['cohort-repos'] as const,
    byCohort: (cohort: number | null) => ['cohort-repos', cohort] as const,
  },
  persons: () => ['persons'] as const,
  bannedWords: () => ['banned-words'] as const,
  ignoredDomains: () => ['ignored-domains'] as const,
  blog: {
    teamStatus: () => ['team-blog-status'] as const,
    syncJobs: () => ['blog-sync-jobs'] as const,
    newPostsAll: () => ['blog-new-posts'] as const,
    newPosts: (sinceMinutes: number) => ['blog-new-posts', sinceMinutes] as const,
  },
  activityLogs: () => ['activity-logs'] as const,
  syncQueueJobs: () => ['sync-queue-jobs'] as const,
  tecotalkSyncStatus: () => ['tecotalks', 'sync-status'] as const,
};
