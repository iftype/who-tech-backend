import { apiFetch } from './api.js';
import type {
  ActivityLog,
  AdminStatus,
  BannedWord,
  BlogPostResponse,
  CohortRepo,
  GithubStatus,
  IgnoredDomain,
  Member,
  MissionRepo,
  NewBlogPost,
  Person,
  RecentSyncJob,
  SyncJob,
  SyncQueueJob,
  TeamBlogStatus,
  TecoTalkAdminItem,
  Workspace,
} from './types.js';

// 어드민 API 엔드포인트를 한곳에 모은다 (ARCHITECTURE_PLAN D-1). 화면은 경로·메서드를 직접 쓰지 않고 이 함수만 부른다
const json = (method: string, body?: unknown): RequestInit =>
  body === undefined ? { method } : { method, body: JSON.stringify(body) };

export const adminApi = {
  status: () => apiFetch<AdminStatus>('/admin/status'),
  githubStatus: () => apiFetch<GithubStatus>('/admin/github-status'),

  workspace: {
    get: () => apiFetch<Workspace>('/admin/workspace'),
    update: (payload: object) => apiFetch<Workspace>('/admin/workspace', json('PUT', payload)),
  },

  members: {
    /** query: URLSearchParams 문자열. 없으면 필터 없이 전체 */
    list: (query?: string) => apiFetch<Member[]>(query === undefined ? '/admin/members' : `/admin/members?${query}`),
    detail: (id: number) => apiFetch<Member>(`/admin/members/${id}`),
    create: (body: { githubId?: string; cohort?: number }) => apiFetch<Member>('/admin/members', json('POST', body)),
    update: (id: number, data: object) => apiFetch<Member>(`/admin/members/${id}`, json('PATCH', data)),
    remove: (id: number) => apiFetch(`/admin/members/${id}`, json('DELETE')),
    cohorts: () => apiFetch<number[]>('/admin/members/cohorts'),
    removeCohort: (id: number, cohort: number) =>
      apiFetch<Member>(`/admin/members/${id}/cohorts/${cohort}`, json('DELETE')),
    removeSubmission: (id: number, submissionId: number) =>
      apiFetch(`/admin/members/${id}/submissions/${submissionId}`, json('DELETE')),
    refreshProfile: (id: number) => apiFetch(`/admin/members/${id}/refresh-profile`, json('POST')),
    refreshProfiles: () =>
      apiFetch<{ checked: number; refreshed: number; failed: number }>('/admin/members/refresh-profiles', json('POST')),
    recalculateCohorts: (id: number) => apiFetch(`/admin/members/${id}/recalculate-cohorts`, json('POST')),
    /** 240초 안에 끝나면 결과, 아니면 큐 작업(202) */
    resyncSubmissions: (id: number) =>
      apiFetch<{ totalSynced: number } | { id: string; status: string }>(
        `/admin/members/${id}/resync-submissions`,
        json('POST'),
      ),
    blogPosts: (id: number) => apiFetch<BlogPostResponse>(`/admin/members/${id}/blog-posts`),
  },

  repos: {
    /** query: '' 또는 '?status=...' */
    list: (query = '') => apiFetch<MissionRepo[]>(`/admin/repos${query}`),
    update: (id: number, data: object) => apiFetch(`/admin/repos/${id}`, json('PATCH', data)),
    remove: (id: number) => apiFetch(`/admin/repos/${id}`, json('DELETE')),
    discover: () =>
      apiFetch<{ discovered: number; created: number; updated: number }>('/admin/repos/discover', json('POST')),
    sync: (id: number) => apiFetch<SyncJob>(`/admin/repos/${id}/sync`, json('POST')),
    syncJobs: () => apiFetch<RecentSyncJob[]>('/admin/repos/sync-jobs'),
    syncJob: (jobId: string) => apiFetch<SyncJob>(`/admin/repos/sync-jobs/${jobId}`),
  },

  cohortRepos: {
    list: (cohort: number) => apiFetch<CohortRepo[]>(`/admin/cohort-repos?cohort=${cohort}`),
    create: (cohort: number, missionRepoId: number) =>
      apiFetch<CohortRepo>('/admin/cohort-repos', json('POST', { cohort, missionRepoId })),
    update: (id: number, patch: { order?: number; level?: number | null }) =>
      apiFetch<CohortRepo>(`/admin/cohort-repos/${id}`, json('PATCH', patch)),
    remove: (id: number) => apiFetch(`/admin/cohort-repos/${id}`, json('DELETE')),
    autoFill: (cohort: number) =>
      apiFetch<{ added: number }>('/admin/cohort-repos/auto-fill', json('POST', { cohort })),
  },

  persons: {
    list: () => apiFetch<Person[]>('/admin/persons'),
    create: (body: { displayName: string; note: string }) => apiFetch<Person>('/admin/persons', json('POST', body)),
    remove: (id: number) => apiFetch(`/admin/persons/${id}`, json('DELETE')),
    linkMember: (personId: number, memberId: number) =>
      apiFetch(`/admin/persons/${personId}/members/${memberId}`, json('POST')),
    unlinkMember: (personId: number, memberId: number) =>
      apiFetch(`/admin/persons/${personId}/members/${memberId}`, json('DELETE')),
  },

  bannedWords: {
    list: () => apiFetch<BannedWord[]>('/admin/banned-words'),
    create: (word: string) => apiFetch<BannedWord>('/admin/banned-words', json('POST', { word })),
    remove: (id: number) => apiFetch(`/admin/banned-words/${id}`, json('DELETE')),
  },

  ignoredDomains: {
    list: () => apiFetch<IgnoredDomain[]>('/admin/ignored-domains'),
    create: (domain: string) => apiFetch<IgnoredDomain>('/admin/ignored-domains', json('POST', { domain })),
    remove: (id: number) => apiFetch(`/admin/ignored-domains/${id}`, json('DELETE')),
  },

  blog: {
    teamStatus: () => apiFetch<TeamBlogStatus[]>('/admin/blog/team'),
    updateTeam: (id: number | undefined, form: object) => apiFetch(`/admin/blog/team/${id}`, json('PATCH', form)),
    syncTeam: () =>
      apiFetch<{ synced: number; deleted: number; failures: unknown[] }>('/admin/blog/team/sync', json('POST')),
    newPosts: (sinceMinutes: number) => apiFetch<NewBlogPost[]>(`/admin/blog/new-posts?sinceMinutes=${sinceMinutes}`),
    sync: () => apiFetch<{ id: string; status: string }>('/admin/blog/sync', json('POST')),
    backfill: () => apiFetch<{ updated: number }>('/admin/blog/backfill', json('POST')),
    syncJobs: () => apiFetch<RecentSyncJob[]>('/admin/blog/sync-jobs'),
  },

  logs: {
    list: () => apiFetch<ActivityLog[]>('/admin/logs'),
    add: (entry: { type: string; message: string }) => apiFetch('/admin/logs', json('POST', entry)),
    clear: () => apiFetch('/admin/logs', json('DELETE')),
  },

  sync: {
    // 240초 안에 끝나면 결과, 앞선 작업 때문에 아직이면 큐에 남은 작업(202)
    continuous: () =>
      apiFetch<{ totalSynced: number; reposSynced: number } | SyncQueueJob>('/admin/sync/continuous', json('POST')),
    jobs: () => apiFetch<SyncQueueJob[]>('/admin/sync/jobs'),
    createJob: (params: object) =>
      apiFetch<{ id: string; status: string; createdAt: string }>('/admin/sync/jobs', json('POST', params)),
    cancelJob: (jobId: string) => apiFetch<{ success: boolean }>(`/admin/sync/jobs/${jobId}`, json('DELETE')),
  },

  tecotalk: {
    list: () => apiFetch<TecoTalkAdminItem[]>('/admin/tecotalk'),
    sync: (mode?: string) =>
      apiFetch<{ total: number; matched: number; ambiguous: number; unmatched: number }>(
        `/admin/tecotalk/sync${mode === 'full' ? '?mode=full' : ''}`,
        json('POST'),
      ),
  },
};
