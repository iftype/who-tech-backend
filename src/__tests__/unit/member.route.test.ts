import { jest, describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createMemberRouter } from '../../features/member/member.route.js';
import { errorHandler } from '../../shared/middleware/error.js';
import type { MemberService } from '../../features/member/member.service.js';
import type { SyncAdminService } from '../../features/sync/index.js';

type AsyncMock = ReturnType<typeof jest.fn<(...args: unknown[]) => Promise<unknown>>>;
const asyncMock = (value: unknown): AsyncMock =>
  jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(value);

function makeApp() {
  const service = {
    listMembers: asyncMock([{ id: 1 }]),
    createMember: asyncMock({ id: 1 }),
    listMemberCohorts: asyncMock([{ cohort: 8 }]),
    get: asyncMock({ id: 1 }),
    getMemberBlogPosts: asyncMock([{ id: 9 }]),
    refreshWorkspaceProfiles: asyncMock({ checked: 1 }),
    refreshMemberProfile: asyncMock({ id: 1, profileRefreshError: null }),
    updateMember: asyncMock({ id: 1 }),
    changeMemberCohort: asyncMock({ id: 1, cohort: 8 }),
    deleteMemberCohort: asyncMock({ id: 1 }),
    recalculateMemberCohorts: asyncMock({ id: 1 }),
    deleteAllMembers: asyncMock({ count: 2 }),
    deleteMember: asyncMock({ id: 1 }),
    deleteSubmission: asyncMock({ success: true }),
  };
  const sync = { requestMemberSync: asyncMock({ done: true, result: { totalSynced: 3, reposSynced: 2 } }) };
  const app = express();
  app.use(express.json());
  app.use(
    '/admin/members',
    createMemberRouter(service as unknown as MemberService, sync as unknown as SyncAdminService),
  );
  app.use(errorHandler);
  return { app, service, sync };
}

describe('admin member routes', () => {
  describe('GET /admin/members', () => {
    it('should map query filters including hasBlog', async () => {
      const { app, service } = makeApp();

      await request(app).get('/admin/members?q=가람&cohort=8&hasBlog=true&track=backend&role=crew');
      await request(app).get('/admin/members?hasBlog=false');
      await request(app).get('/admin/members?hasBlog=maybe&cohort=x');

      expect(service.listMembers.mock.calls.map((c) => c[0])).toEqual([
        { q: '가람', cohort: 8, hasBlog: true, track: 'backend', role: 'crew' },
        { hasBlog: false },
        {},
      ]);
    });
  });

  describe('POST /admin/members', () => {
    it('should require a GitHub id or user id', async () => {
      const { app, service } = makeApp();

      const res = await request(app).post('/admin/members').send({ nickname: 'x' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'githubId or githubUserId required' });
      expect(service.createMember).not.toHaveBeenCalled();
    });

    it('should create by GitHub id or by user id only', async () => {
      const { app, service } = makeApp();

      const byId = await request(app).post('/admin/members').send({ githubId: 'crew1', cohort: 8 });
      await request(app).post('/admin/members').send({ githubUserId: 0 });

      expect(byId.status).toBe(201);
      expect(service.createMember.mock.calls.map((c) => c[0])).toEqual([
        { githubId: 'crew1', cohort: 8 },
        { githubUserId: 0, githubId: '' },
      ]);
    });
  });

  it('GET /admin/members/cohorts should list cohorts', async () => {
    const { app } = makeApp();
    expect((await request(app).get('/admin/members/cohorts')).body).toEqual([{ cohort: 8 }]);
  });

  describe('GET /admin/members/:id', () => {
    it('should return the member, 404 when missing, and 400 for invalid ids', async () => {
      const { app, service } = makeApp();

      const ok = await request(app).get('/admin/members/1');
      service.get.mockResolvedValue(null);
      const missing = await request(app).get('/admin/members/2');
      const invalid = await request(app).get('/admin/members/abc');

      expect(ok.body).toEqual({ id: 1 });
      expect(missing.status).toBe(404);
      expect(missing.body).toEqual({ message: 'member not found' });
      expect(invalid.status).toBe(400);
      expect(invalid.body).toEqual({ message: 'invalid id' });
    });
  });

  it('GET /admin/members/:id/blog-posts should default to page 1', async () => {
    const { app, service } = makeApp();

    await request(app).get('/admin/members/1/blog-posts');
    await request(app).get('/admin/members/1/blog-posts?page=3');

    expect(service.getMemberBlogPosts.mock.calls).toEqual([
      [1, 1],
      [1, 3],
    ]);
  });

  it('POST /admin/members/refresh-profiles should pass numeric options', async () => {
    const { app, service } = makeApp();

    await request(app).post('/admin/members/refresh-profiles');
    await request(app).post('/admin/members/refresh-profiles?limit=5&cohort=8&staleHours=12');

    expect(service.refreshWorkspaceProfiles.mock.calls.map((c) => c[0])).toEqual([
      { limit: 30 },
      { limit: 5, cohort: 8, staleHours: 12 },
    ]);
  });

  describe('POST /admin/members/:id/refresh-profile', () => {
    it('should return the member or 502 with the upstream profile error', async () => {
      const { app, service } = makeApp();

      const ok = await request(app).post('/admin/members/1/refresh-profile');
      service.refreshMemberProfile.mockResolvedValue({ id: 1, profileRefreshError: 'Not Found' });
      const failed = await request(app).post('/admin/members/1/refresh-profile');

      expect(ok.status).toBe(200);
      expect(failed.status).toBe(502);
      expect(failed.body).toEqual({ message: 'Not Found', member: { id: 1, profileRefreshError: 'Not Found' } });
    });
  });

  it('PATCH /admin/members/:id should update the member', async () => {
    const { app, service } = makeApp();

    await request(app).patch('/admin/members/1').send({ manualNickname: '닉', cohortLocked: true });

    expect(service.updateMember).toHaveBeenCalledWith(1, { manualNickname: '닉', cohortLocked: true });
  });

  describe('cohort routes', () => {
    it('should require newCohort when changing a cohort', async () => {
      const { app, service } = makeApp();

      const missing = await request(app).patch('/admin/members/1/cohorts/7').send({});
      const ok = await request(app).patch('/admin/members/1/cohorts/7').send({ newCohort: 8 });

      expect(missing.status).toBe(400);
      expect(missing.body).toEqual({ message: 'newCohort required' });
      expect(ok.body).toEqual({ id: 1, cohort: 8 });
      expect(service.changeMemberCohort).toHaveBeenCalledWith(1, 7, 8);
    });

    it('should delete a cohort and recalculate cohorts', async () => {
      const { app, service } = makeApp();

      await request(app).delete('/admin/members/1/cohorts/7');
      await request(app).post('/admin/members/1/recalculate-cohorts');

      expect(service.deleteMemberCohort).toHaveBeenCalledWith(1, 7);
      expect(service.recalculateMemberCohorts).toHaveBeenCalledWith(1);
    });
  });

  describe('deletion and resync', () => {
    it('should delete all members, one member, and one submission with 204', async () => {
      const { app, service } = makeApp();

      const all = await request(app).delete('/admin/members');
      const one = await request(app).delete('/admin/members/1');
      const submission = await request(app).delete('/admin/members/1/submissions/5');

      expect([all.status, one.status, submission.status]).toEqual([204, 204, 204]);
      expect(service.deleteAllMembers).toHaveBeenCalled();
      expect(service.deleteMember).toHaveBeenCalledWith(1);
      expect(service.deleteSubmission).toHaveBeenCalledWith(1, 5);
    });

    // 멤버 PR 재수집은 싱크 큐(GitHub 레인)의 member 작업이다. 240초 안에 끝나면 200, 아니면 202 + 작업
    it('should resync submissions of a member through the sync queue', async () => {
      const { app, service, sync } = makeApp();
      service.get.mockResolvedValue({ id: 1, githubId: 'crew9' });

      const done = await request(app).post('/admin/members/1/resync-submissions');
      sync.requestMemberSync.mockResolvedValue({ done: false, job: { id: 'job-1', type: 'member', status: 'queued' } });
      const queued = await request(app).post('/admin/members/1/resync-submissions');
      service.get.mockResolvedValue(null);
      const missing = await request(app).post('/admin/members/2/resync-submissions');

      expect([done.status, done.body]).toEqual([200, { totalSynced: 3, reposSynced: 2 }]);
      expect([queued.status, queued.body]).toEqual([202, { id: 'job-1', type: 'member', status: 'queued' }]);
      expect([missing.status, missing.body]).toEqual([404, { message: 'member not found' }]);
      expect(sync.requestMemberSync.mock.calls).toEqual([['crew9'], ['crew9']]);
    });
  });
});
