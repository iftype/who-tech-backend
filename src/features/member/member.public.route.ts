import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { parseOptionalNumberQuery } from '../../shared/validation.js';
import type { MemberPublicService } from './member.public.service.js';

export function createMemberPublicRouter(service: MemberPublicService) {
  const router = Router();

  // GET /members?q=&cohort=&track=&role=
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const q = typeof req.query['q'] === 'string' ? req.query['q'] : undefined;
      const cohort = parseOptionalNumberQuery(req.query['cohort']);
      const track = typeof req.query['track'] === 'string' ? req.query['track'] : undefined;
      const role = typeof req.query['role'] === 'string' ? req.query['role'] : undefined;
      const roleGroup =
        typeof req.query['roleGroup'] === 'string' ? (req.query['roleGroup'] as 'crew' | 'staff') : undefined;
      res.json(
        await service.searchMembers({
          ...(q ? { q } : {}),
          ...(cohort !== undefined ? { cohort } : {}),
          ...(track ? { track } : {}),
          ...(role ? { role } : {}),
          ...(roleGroup ? { roleGroup } : {}),
        }),
      );
    }),
  );

  router.get(
    '/feed',
    asyncHandler(async (req, res) => {
      const cohort = parseOptionalNumberQuery(req.query['cohort']);
      const track = typeof req.query['track'] === 'string' ? req.query['track'] : undefined;
      const days = parseOptionalNumberQuery(req.query['days']);
      const cursor = typeof req.query['cursor'] === 'string' ? req.query['cursor'] : undefined;
      const limit = days != null && days <= 7 ? 20 : 30;

      const result = await service.getFeed({
        ...(cohort !== undefined ? { cohort } : {}),
        ...(track ? { track } : {}),
        ...(days != null ? { days } : {}),
        limit,
        ...(cursor ? { cursor } : {}),
      });

      res.json(result);
    }),
  );
  router.get(
    '/cohorts',
    asyncHandler(async (req, res) => {
      res.json(await service.getCohorts());
    }),
  );

  // GET /members/:githubId
  router.get(
    '/:githubId',
    asyncHandler(async (req, res) => {
      const githubId = typeof req.params['githubId'] === 'string' ? req.params['githubId'] : '';
      const member = await service.getMemberDetail(githubId);
      if (!member) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }
      res.json(member);
    }),
  );

  router.get(
    '/:githubId/blog-posts',
    asyncHandler(async (req, res) => {
      const githubId = typeof req.params['githubId'] === 'string' ? req.params['githubId'] : '';
      const posts = await service.getMemberBlogPosts(githubId);
      if (!posts) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }
      res.json(posts);
    }),
  );

  // POST /members/:githubId/refresh
  router.post(
    '/:githubId/refresh',
    asyncHandler(async (req, res) => {
      const githubId = typeof req.params['githubId'] === 'string' ? req.params['githubId'] : '';
      try {
        const result = await service.refreshMemberProfile(githubId);
        if ('rateLimited' in result && result.rateLimited) {
          res.status(429).json({
            error: 'Rate limited',
            remainingSeconds: result.remainingSeconds,
            message: `${result.remainingSeconds}초 후에 다시 시도해주세요`,
          });
          return;
        }
        res.json(result.member);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'Member not found') {
          res.status(404).json({ error: 'Member not found' });
          return;
        }
        res.status(500).json({ error: message });
      }
    }),
  );

  return router;
}
