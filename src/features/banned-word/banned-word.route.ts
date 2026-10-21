import { Router } from 'express';
import { HttpError, badRequest } from '../../shared/http.js';

import { parseId } from '../../shared/validation.js';
import { isUniqueConstraintError } from '../../shared/prisma-error.js';
import type { BannedWordRepository } from '../../db/repositories/banned-word.repository.js';
import type { WorkspaceService } from '../workspace/index.js';

export function createBannedWordRouter(deps: {
  bannedWordRepo: BannedWordRepository;
  workspaceService: WorkspaceService;
}) {
  const { bannedWordRepo, workspaceService } = deps;
  const router = Router();

  router.get('/', async (_req, res) => {
    const workspace = await workspaceService.getOrThrow();
    res.json(await bannedWordRepo.findAll(workspace.id));
  });

  router.post('/', async (req, res) => {
    const { word } = req.body as { word?: string };
    if (!word?.trim()) badRequest('word required');
    const workspace = await workspaceService.getOrThrow();
    try {
      const created = await bannedWordRepo.create(workspace.id, word.trim());
      res.status(201).json(created);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new HttpError(409, 'word already exists');
      throw error;
    }
  });

  router.delete('/:id', async (req, res) => {
    await bannedWordRepo.delete(parseId(req.params['id']));
    res.status(204).end();
  });

  return router;
}
