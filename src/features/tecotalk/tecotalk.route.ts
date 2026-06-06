import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { parseOptionalNumberQuery } from '../../shared/validation.js';
import type { TecoTalkService } from './tecotalk.service.js';

export function createTecoTalkRouter(service: TecoTalkService) {
  const router = Router();

  // 재생목록 수집 + 멤버 매칭
  // 기본: 증분(최신만) — 주간 cron용 / ?mode=full: 전체 백필 — 초기 1회 수동 실행
  router.post(
    '/sync',
    asyncHandler(async (req, res) => {
      const full = req.query['mode'] === 'full' || req.query['full'] === 'true';
      const result = await service.syncTecoTalks({ full });
      res.json(result);
    }),
  );

  // 테코톡 목록 조회 (cohort / matchStatus 필터)
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const cohort = parseOptionalNumberQuery(req.query['cohort']);
      const matchStatus = typeof req.query['matchStatus'] === 'string' ? req.query['matchStatus'] : undefined;
      res.json(
        await service.listTecoTalks({
          ...(cohort !== undefined ? { cohort } : {}),
          ...(matchStatus ? { matchStatus } : {}),
        }),
      );
    }),
  );

  return router;
}
