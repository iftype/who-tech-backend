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
      res.json(
        await service.searchMembers({
          ...(q ? { q } : {}),
          ...(cohort !== undefined ? { cohort } : {}),
          ...(track ? { track } : {}),
          ...(role ? { role } : {}),
        }),
      );
    }),
  );

  router.get(
    '/feed',
    asyncHandler(async (req, res) => {
      const cohort = parseOptionalNumberQuery(req.query['cohort']);
      const track = typeof req.query['track'] === 'string' ? req.query['track'] : undefined;
      const role = typeof req.query['role'] === 'string' ? req.query['role'] : undefined;
      const days = parseOptionalNumberQuery(req.query['days']) ?? 7;
      const cursor = typeof req.query['cursor'] === 'string' ? req.query['cursor'] : undefined;

      const limit = days <= 7 ? 20 : 30;

      const result = await service.getFeed({
        ...(cohort !== undefined ? { cohort } : {}),
        ...(track ? { track } : {}),
        ...(role ? { role } : {}),
        days,
        limit,
        ...(cursor ? { cursor } : {}),
      });

      res.json(result);
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
