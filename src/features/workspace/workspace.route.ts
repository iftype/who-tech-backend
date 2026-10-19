import { Router } from 'express';

import { parseWorkspaceUpdateInput } from './workspace.validation.js';
import type { WorkspaceService } from './workspace.service.js';

export function createWorkspaceRouter(service: WorkspaceService) {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await service.getSettings());
  });

  router.put('/', async (req, res) => {
    res.json(await service.updateSettings(parseWorkspaceUpdateInput(req.body)));
  });

  return router;
}
