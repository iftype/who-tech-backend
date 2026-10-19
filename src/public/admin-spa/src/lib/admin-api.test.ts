import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();
vi.mock('./api.js', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));

const { adminApi } = await import('./admin-api');

// 화면에서 쓰던 apiFetch 호출을 adminApi로 옮긴 뒤에도 같은 경로·메서드·본문을 보내는지 (ARCHITECTURE_PLAN D-1)
type Case = [name: string, call: () => unknown, path: string, init?: { method: string; body?: unknown }];

const cases: Case[] = [
  ['status', () => adminApi.status(), '/admin/status'],
  ['githubStatus', () => adminApi.githubStatus(), '/admin/github-status'],
  ['workspace.get', () => adminApi.workspace.get(), '/admin/workspace'],
  [
    'workspace.update',
    () => adminApi.workspace.update({ blogSyncEnabled: false }),
    '/admin/workspace',
    { method: 'PUT', body: { blogSyncEnabled: false } },
  ],
  ['members.list (all)', () => adminApi.members.list(), '/admin/members'],
  ['members.list (query)', () => adminApi.members.list('cohort=8'), '/admin/members?cohort=8'],
  ['members.list (empty query)', () => adminApi.members.list(''), '/admin/members?'],
  ['members.detail', () => adminApi.members.detail(3), '/admin/members/3'],
  [
    'members.create',
    () => adminApi.members.create({ githubId: 'a', cohort: undefined }),
    '/admin/members',
    { method: 'POST', body: { githubId: 'a' } },
  ],
  [
    'members.update',
    () => adminApi.members.update(3, { cohortLocked: true }),
    '/admin/members/3',
    { method: 'PATCH', body: { cohortLocked: true } },
  ],
  ['members.remove', () => adminApi.members.remove(3), '/admin/members/3', { method: 'DELETE' }],
  ['members.cohorts', () => adminApi.members.cohorts(), '/admin/members/cohorts'],
  [
    'members.removeCohort',
    () => adminApi.members.removeCohort(3, 8),
    '/admin/members/3/cohorts/8',
    { method: 'DELETE' },
  ],
  [
    'members.removeSubmission',
    () => adminApi.members.removeSubmission(3, 9),
    '/admin/members/3/submissions/9',
    { method: 'DELETE' },
  ],
  [
    'members.refreshProfile',
    () => adminApi.members.refreshProfile(3),
    '/admin/members/3/refresh-profile',
    { method: 'POST' },
  ],
  [
    'members.refreshProfiles',
    () => adminApi.members.refreshProfiles(),
    '/admin/members/refresh-profiles',
    { method: 'POST' },
  ],
  [
    'members.recalculateCohorts',
    () => adminApi.members.recalculateCohorts(3),
    '/admin/members/3/recalculate-cohorts',
    { method: 'POST' },
  ],
  [
    'members.resyncSubmissions',
    () => adminApi.members.resyncSubmissions(3),
    '/admin/members/3/resync-submissions',
    { method: 'POST' },
  ],
  ['members.blogPosts', () => adminApi.members.blogPosts(3), '/admin/members/3/blog-posts'],
  ['repos.list (all)', () => adminApi.repos.list(), '/admin/repos'],
  ['repos.list (status)', () => adminApi.repos.list('?status=active'), '/admin/repos?status=active'],
  [
    'repos.update',
    () => adminApi.repos.update(4, { lastSyncAt: null }),
    '/admin/repos/4',
    { method: 'PATCH', body: { lastSyncAt: null } },
  ],
  ['repos.remove', () => adminApi.repos.remove(4), '/admin/repos/4', { method: 'DELETE' }],
  ['repos.discover', () => adminApi.repos.discover(), '/admin/repos/discover', { method: 'POST' }],
  ['repos.sync', () => adminApi.repos.sync(4), '/admin/repos/4/sync', { method: 'POST' }],
  ['repos.syncJobs', () => adminApi.repos.syncJobs(), '/admin/repos/sync-jobs'],
  ['repos.syncJob', () => adminApi.repos.syncJob('j1'), '/admin/repos/sync-jobs/j1'],
  ['cohortRepos.list', () => adminApi.cohortRepos.list(8), '/admin/cohort-repos?cohort=8'],
  [
    'cohortRepos.create',
    () => adminApi.cohortRepos.create(8, 4),
    '/admin/cohort-repos',
    { method: 'POST', body: { cohort: 8, missionRepoId: 4 } },
  ],
  [
    'cohortRepos.update',
    () => adminApi.cohortRepos.update(5, { level: null }),
    '/admin/cohort-repos/5',
    { method: 'PATCH', body: { level: null } },
  ],
  ['cohortRepos.remove', () => adminApi.cohortRepos.remove(5), '/admin/cohort-repos/5', { method: 'DELETE' }],
  [
    'cohortRepos.autoFill',
    () => adminApi.cohortRepos.autoFill(8),
    '/admin/cohort-repos/auto-fill',
    { method: 'POST', body: { cohort: 8 } },
  ],
  ['persons.list', () => adminApi.persons.list(), '/admin/persons'],
  [
    'persons.create',
    () => adminApi.persons.create({ displayName: 'a', note: 'b' }),
    '/admin/persons',
    { method: 'POST', body: { displayName: 'a', note: 'b' } },
  ],
  ['persons.remove', () => adminApi.persons.remove(2), '/admin/persons/2', { method: 'DELETE' }],
  ['persons.linkMember', () => adminApi.persons.linkMember(2, 3), '/admin/persons/2/members/3', { method: 'POST' }],
  [
    'persons.unlinkMember',
    () => adminApi.persons.unlinkMember(2, 3),
    '/admin/persons/2/members/3',
    { method: 'DELETE' },
  ],
  ['bannedWords.list', () => adminApi.bannedWords.list(), '/admin/banned-words'],
  [
    'bannedWords.create',
    () => adminApi.bannedWords.create('x'),
    '/admin/banned-words',
    { method: 'POST', body: { word: 'x' } },
  ],
  ['bannedWords.remove', () => adminApi.bannedWords.remove(1), '/admin/banned-words/1', { method: 'DELETE' }],
  ['ignoredDomains.list', () => adminApi.ignoredDomains.list(), '/admin/ignored-domains'],
  [
    'ignoredDomains.create',
    () => adminApi.ignoredDomains.create('d.com'),
    '/admin/ignored-domains',
    { method: 'POST', body: { domain: 'd.com' } },
  ],
  ['ignoredDomains.remove', () => adminApi.ignoredDomains.remove(1), '/admin/ignored-domains/1', { method: 'DELETE' }],
  ['blog.teamStatus', () => adminApi.blog.teamStatus(), '/admin/blog/team'],
  [
    'blog.updateTeam',
    () => adminApi.blog.updateTeam(1, { enabled: false }),
    '/admin/blog/team/1',
    { method: 'PATCH', body: { enabled: false } },
  ],
  ['blog.syncTeam', () => adminApi.blog.syncTeam(), '/admin/blog/team/sync', { method: 'POST' }],
  ['blog.newPosts', () => adminApi.blog.newPosts(60), '/admin/blog/new-posts?sinceMinutes=60'],
  ['blog.sync', () => adminApi.blog.sync(), '/admin/blog/sync', { method: 'POST' }],
  ['blog.backfill', () => adminApi.blog.backfill(), '/admin/blog/backfill', { method: 'POST' }],
  ['blog.syncJobs', () => adminApi.blog.syncJobs(), '/admin/blog/sync-jobs'],
  ['logs.list', () => adminApi.logs.list(), '/admin/logs'],
  [
    'logs.add',
    () => adminApi.logs.add({ type: 'info', message: 'm' }),
    '/admin/logs',
    { method: 'POST', body: { type: 'info', message: 'm' } },
  ],
  ['logs.clear', () => adminApi.logs.clear(), '/admin/logs', { method: 'DELETE' }],
  ['sync.continuous', () => adminApi.sync.continuous(), '/admin/sync/continuous', { method: 'POST' }],
  ['sync.jobs', () => adminApi.sync.jobs(), '/admin/sync/jobs'],
  [
    'sync.createJob',
    () => adminApi.sync.createJob({ type: 'workspace' }),
    '/admin/sync/jobs',
    { method: 'POST', body: { type: 'workspace' } },
  ],
  ['sync.cancelJob', () => adminApi.sync.cancelJob('j1'), '/admin/sync/jobs/j1', { method: 'DELETE' }],
  ['tecotalk.list', () => adminApi.tecotalk.list(), '/admin/tecotalk'],
  [
    'tecotalk.sync (incremental)',
    () => adminApi.tecotalk.sync('incremental'),
    '/admin/tecotalk/sync',
    { method: 'POST' },
  ],
  ['tecotalk.sync (full)', () => adminApi.tecotalk.sync('full'), '/admin/tecotalk/sync?mode=full', { method: 'POST' }],
];

describe('adminApi', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({});
  });

  it.each(cases)('%s', async (_name, call, path, init) => {
    await call();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    const [calledPath, calledInit] = apiFetch.mock.calls[0]!;
    expect(calledPath).toBe(path);
    if (!init) {
      expect(calledInit).toBeUndefined();
      return;
    }
    expect(calledInit.method).toBe(init.method);
    if (init.body === undefined) expect(calledInit.body).toBeUndefined();
    else expect(JSON.parse(calledInit.body)).toEqual(init.body);
  });
});
