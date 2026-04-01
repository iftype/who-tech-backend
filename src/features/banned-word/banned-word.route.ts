import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { parseId } from '../../shared/validation.js';
import type { BannedWordRepository } from '../../db/repositories/banned-word.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';

export function createBannedWordRouter(deps: {
  bannedWordRepo: BannedWordRepository;
  workspaceService: WorkspaceService;
}) {
  const { bannedWordRepo, workspaceService } = deps;
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const workspace = await workspaceService.getOrThrow();
      res.json(await bannedWordRepo.findAll(workspace.id));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { word } = req.body as { word?: string };
      if (!word?.trim()) {
        res.status(400).json({ error: 'word required' });
        return;
      }
      const workspace = await workspaceService.getOrThrow();
      const created = await bannedWordRepo.create(workspace.id, word.trim());
      res.status(201).json(created);
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await bannedWordRepo.delete(parseId(req.params['id']));
      res.status(204).end();
    }),
  );

  return router;
}
