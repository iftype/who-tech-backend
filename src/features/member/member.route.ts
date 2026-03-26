import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { parseId } from '../../shared/validation.js';
import { deleteMember, listMembers, updateMember } from './member.service.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : undefined;
    const cohort = typeof req.query['cohort'] === 'string' ? Number(req.query['cohort']) : undefined;
    const hasBlog = req.query['hasBlog'] === 'true' ? true : req.query['hasBlog'] === 'false' ? false : undefined;

    const filters = {
      ...(q ? { q } : {}),
      ...(cohort && !Number.isNaN(cohort) ? { cohort } : {}),
      ...(hasBlog !== undefined ? { hasBlog } : {}),
    };

    res.json(await listMembers(filters));
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params['id']);
    const body = req.body as { manualNickname?: string | null; blog?: string | null };
    res.json(await updateMember(id, body));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params['id']);
    await deleteMember(id);
    res.status(204).end();
  }),
);

export default router;
