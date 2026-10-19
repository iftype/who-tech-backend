import { jest, describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createMemberPublicRouter } from '../../features/member/member.public.route.js';
import { errorHandler } from '../../shared/middleware/error.js';
import type { MemberPublicService } from '../../features/member/member.public.service.js';
import { NotFoundError } from '../../shared/errors.js';

type AsyncMock = ReturnType<typeof jest.fn<(...args: unknown[]) => Promise<unknown>>>;
const asyncMock = (value: unknown): AsyncMock =>
  jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(value);

function makeApp() {
  const service = {
    searchMembersPage: asyncMock({ members: [], totalCount: 0, counts: { crew: 0, staff: 0 }, nextOffset: null }),
    searchMembers: asyncMock([{ githubId: 'crew1' }]),
    getFeed: asyncMock({ posts: [], nextCursor: null, totalCount: 0 }),
    getCohorts: asyncMock([{ cohort: 8 }]),
    visitBlogPost: asyncMock({ url: 'https://blog.example.com/post', viewCount: 2 }),
    getMemberDetail: asyncMock({ githubId: 'crew1' }),
    getMemberBlogPosts: asyncMock([{ id: 1 }]),
    refreshMemberProfile: asyncMock({ rateLimited: false, member: { githubId: 'crew1' } }),
  };
  const app = express();
  app.use(express.json());
  app.use('/members', createMemberPublicRouter(service as unknown as MemberPublicService));
  app.use(errorHandler);
  return { app, service };
}

describe('member public routes', () => {
  describe('GET /members/search', () => {
    it('should use default pagination and no filters', async () => {
      const { app, service } = makeApp();

      const res = await request(app).get('/members/search');

      expect(res.status).toBe(200);
      expect(service.searchMembersPage).toHaveBeenCalledWith({}, { limit: 120, offset: 0 });
    });

    it('should pass filters and clamp limit and offset', async () => {
      const { app, service } = makeApp();

      await request(app).get(
        '/members/search?q=가람&cohort=8&track=backend&role=crew&roleGroup=staff&limit=500&offset=-3',
      );
      await request(app).get('/members/search?limit=0&offset=40');

      expect(service.searchMembersPage.mock.calls[0]).toEqual([
        { q: '가람', cohort: 8, track: 'backend', role: 'crew', roleGroup: 'staff' },
        { limit: 200, offset: 0 },
      ]);
      expect(service.searchMembersPage.mock.calls[1]).toEqual([{}, { limit: 1, offset: 40 }]);
    });
  });

  describe('GET /members', () => {
    it('should search members with the given filters', async () => {
      const { app, service } = makeApp();

      const res = await request(app).get('/members?q=&cohort=7&track=frontend&role=coach&roleGroup=crew');

      expect(res.body).toEqual([{ githubId: 'crew1' }]);
      expect(service.searchMembers).toHaveBeenCalledWith({
        cohort: 7,
        track: 'frontend',
        role: 'coach',
        roleGroup: 'crew',
      });
    });

    it('should ignore non-numeric cohorts', async () => {
      const { app, service } = makeApp();
      await request(app).get('/members?cohort=abc&q=크루');
      expect(service.searchMembers).toHaveBeenCalledWith({ q: '크루' });
    });
  });

  describe('GET /members/feed', () => {
    it('should use 20 items for a recent window and 30 otherwise', async () => {
      const { app, service } = makeApp();

      await request(app).get('/members/feed?days=7&cohort=8&track=backend&cursor=c1');
      await request(app).get('/members/feed?days=30');
      await request(app).get('/members/feed');

      expect(service.getFeed.mock.calls.map((c) => c[0])).toEqual([
        { cohort: 8, track: 'backend', days: 7, limit: 20, cursor: 'c1' },
        { days: 30, limit: 30 },
        { limit: 30 },
      ]);
    });
  });

  it('GET /members/cohorts should list cohorts', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/members/cohorts');
    expect(res.body).toEqual([{ cohort: 8 }]);
  });

  describe('GET /members/blog-posts/:id/visit', () => {
    it('should redirect to the post', async () => {
      const { app, service } = makeApp();

      const res = await request(app).get('/members/blog-posts/5/visit');

      expect(res.status).toBe(302);
      expect(res.headers['location']).toBe('https://blog.example.com/post');
      expect(service.visitBlogPost).toHaveBeenCalledWith(5);
    });

    it('should reject an invalid id and report missing posts', async () => {
      const { app, service } = makeApp();
      service.visitBlogPost.mockResolvedValue(null);

      const invalid = await request(app).get('/members/blog-posts/abc/visit');
      const missing = await request(app).get('/members/blog-posts/9/visit');

      expect(invalid.status).toBe(400);
      expect(invalid.body).toEqual({ error: 'invalid post id' });
      expect(missing.status).toBe(404);
      expect(missing.body).toEqual({ error: 'Blog post not found' });
    });
  });

  describe('GET /members/:githubId', () => {
    it('should return the member detail', async () => {
      const { app, service } = makeApp();
      const res = await request(app).get('/members/crew1');
      expect(res.body).toEqual({ githubId: 'crew1' });
      expect(service.getMemberDetail).toHaveBeenCalledWith('crew1');
    });

    it('should return 404 for unknown members', async () => {
      const { app, service } = makeApp();
      service.getMemberDetail.mockResolvedValue(null);
      const res = await request(app).get('/members/nobody');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Member not found' });
    });

    it('should return 500 when the service fails', async () => {
      const { app, service } = makeApp();
      service.getMemberDetail.mockRejectedValue(new Error('db down'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(app).get('/members/crew1');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'internal server error' });
    });
  });

  describe('GET /members/:githubId/blog-posts', () => {
    it('should return posts or 404', async () => {
      const { app, service } = makeApp();

      const ok = await request(app).get('/members/crew1/blog-posts');
      service.getMemberBlogPosts.mockResolvedValue(null);
      const missing = await request(app).get('/members/nobody/blog-posts');

      expect(ok.body).toEqual([{ id: 1 }]);
      expect(missing.status).toBe(404);
    });
  });

  describe('POST /members/:githubId/refresh', () => {
    it('should return the refreshed member', async () => {
      const { app, service } = makeApp();

      const res = await request(app).post('/members/crew1/refresh');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ githubId: 'crew1' });
      expect(service.refreshMemberProfile).toHaveBeenCalledWith('crew1');
    });

    it('should return 429 with the remaining seconds when rate limited', async () => {
      const { app, service } = makeApp();
      service.refreshMemberProfile.mockResolvedValue({ rateLimited: true, remainingSeconds: 37 });

      const res = await request(app).post('/members/crew1/refresh');

      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        error: 'Rate limited',
        remainingSeconds: 37,
        message: '37초 후에 다시 시도해주세요',
      });
    });

    it('should map a missing member to 404 and other failures to 500', async () => {
      const { app, service } = makeApp();
      service.refreshMemberProfile.mockRejectedValueOnce(new NotFoundError('Member not found'));
      service.refreshMemberProfile.mockRejectedValueOnce(new Error('github down'));
      service.refreshMemberProfile.mockRejectedValueOnce('weird');

      const missing = await request(app).post('/members/nobody/refresh');
      const failed = await request(app).post('/members/crew1/refresh');
      const weird = await request(app).post('/members/crew1/refresh');

      expect(missing.status).toBe(404);
      expect(failed.status).toBe(500);
      expect(failed.body).toEqual({ error: 'github down' });
      expect(weird.body).toEqual({ error: 'weird' });
    });
  });

  describe('POST /members/:githubId/refresh overall limit', () => {
    it('should cap refreshes of many different members (GitHub quota)', async () => {
      const service = { refreshMemberProfile: jest.fn(async () => ({ member: { githubId: 'x' } })) };
      const app = express();
      app.use('/members', createMemberPublicRouter(service as never, { refreshLimit: 2 }));

      expect((await request(app).post('/members/a/refresh')).status).toBe(200);
      expect((await request(app).post('/members/b/refresh')).status).toBe(200);
      const blocked = await request(app).post('/members/c/refresh');

      // 웹은 429 본문의 remainingSeconds·message로 카운트다운을 띄운다 → 아이디별 제한과 같은 모양
      expect(blocked.status).toBe(429);
      expect(blocked.body).toMatchObject({
        error: 'Rate limited',
        message: expect.stringContaining('초 후에 다시 시도해주세요'),
      });
      expect(blocked.body.remainingSeconds).toBeGreaterThan(0);
      expect(service.refreshMemberProfile).toHaveBeenCalledTimes(2);
    });
  });
});
