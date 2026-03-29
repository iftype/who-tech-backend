import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import type { MemberPublicService } from './member.public.service.js';

export function createMemberPublicRouter(service: MemberPublicService) {
  const router = Router();

  // GET /members?q=&cohort=&track=&role=
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const q = typeof req.query['q'] === 'string' ? req.query['q'] : undefined;
      const cohort = typeof req.query['cohort'] === 'string' ? Number(req.query['cohort']) : undefined;
      const track = typeof req.query['track'] === 'string' ? req.query['track'] : undefined;
      const role = typeof req.query['role'] === 'string' ? req.query['role'] : undefined;
      res.json(
        await service.searchMembers({
          ...(q ? { q } : {}),
          ...(cohort && !Number.isNaN(cohort) ? { cohort } : {}),
          ...(track ? { track } : {}),
          ...(role ? { role } : {}),
        }),
      );
    }),
  );

  // GET /members/feed?cohort=&track=
  router.get(
    '/feed',
    asyncHandler(async (req, res) => {
      const cohort = typeof req.query['cohort'] === 'string' ? Number(req.query['cohort']) : undefined;
      const track = typeof req.query['track'] === 'string' ? req.query['track'] : undefined;

      // range 파라미터 파싱 로직 추가
      const rangeParam = typeof req.query['range'] === 'string' ? req.query['range'] : undefined;

      let days = 7;
      if (rangeParam) {
        const parsedDays = parseInt(rangeParam.replace('d', ''), 10);
        if (!isNaN(parsedDays)) {
          days = Math.min(parsedDays, 30); // 최대 30일 제한
        }
      }

      res.json(
        await service.getFeed({
          ...(cohort && !Number.isNaN(cohort) ? { cohort } : {}),
          ...(track ? { track } : {}),
          days, // 서비스 호출 시 days 전달
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
