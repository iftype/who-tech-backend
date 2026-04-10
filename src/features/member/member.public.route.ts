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

  // GET /members/feed?cohort=&track=
  // [수정된 라우터 코드]

  router.get(
    '/feed',
    asyncHandler(async (req, res) => {
      const cohort = parseOptionalNumberQuery(req.query['cohort']);
      const track = typeof req.query['track'] === 'string' ? req.query['track'] : undefined;
      const role = typeof req.query['role'] === 'string' ? req.query['role'] : undefined;
      const days = parseOptionalNumberQuery(req.query['days']) ?? 7;

      const limit = days <= 7 ? 50 : 200;

      res.json(
        await service.getFeed({
          ...(cohort !== undefined ? { cohort } : {}),
          ...(track ? { track } : {}),
          ...(role ? { role } : {}),
          days,
          limit,
        }),
      );
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

  return router;
}
