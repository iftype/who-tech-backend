import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { parseId, parseRepoCreateInput, parseRepoUpdateInput } from '../../shared/validation.js';
import {
  createRepo,
  deleteRepo,
  listRepos,
  refreshRepoCandidates,
  syncRepoById,
  updateRepoMatchingRules,
} from './repo.service.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const status = typeof _req.query['status'] === 'string' ? _req.query['status'] : undefined;
    res.json(await listRepos(status));
  }),
);

router.post(
  '/discover',
  asyncHandler(async (_req, res) => {
    res.json(await refreshRepoCandidates());
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const repo = await createRepo(parseRepoCreateInput(req.body));
    res.status(201).json(repo);
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params['id']);
    const input = parseRepoUpdateInput(req.body);
    res.json(await updateRepoMatchingRules(id, input));
  }),
);

router.post(
  '/:id/sync',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params['id']);
    res.json(await syncRepoById(id));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params['id']);
    await deleteRepo(id);
    res.status(204).end();
  }),
);

export default router;
