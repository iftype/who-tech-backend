import { Router } from 'express';
import { asyncHandler, badRequest } from '../../shared/http.js';
import { parseNumberQuery } from '../../shared/validation.js';
import type { ArchiveService } from './archive.service.js';

export function createArchiveRouter(service: ArchiveService) {
  const router = Router();

  // GET /admin/archive?cohort=8[&track=backend][&format=md]
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const cohort = parseNumberQuery(req.query['cohort']);
      if (Number.isNaN(cohort) || cohort < 1) {
        return badRequest('cohort is required (e.g. ?cohort=8)');
      }

      const track = typeof req.query['track'] === 'string' ? req.query['track'] : undefined;
      const result = await service.generateCohortMarkdown(cohort, track);

      const format = req.query['format'];
      if (format === 'md' || req.headers['accept']?.includes('text/plain')) {
        res.type('text/plain; charset=utf-8').send(result.markdown);
        return;
      }
      res.json(result);
    }),
  );

  return router;
}
