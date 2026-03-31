import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { parseId } from '../../shared/validation.js';
import type { IgnoredDomainRepository } from '../../db/repositories/ignored-domain.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';

export function createIgnoredDomainRouter(deps: {
  ignoredDomainRepo: IgnoredDomainRepository;
  workspaceService: WorkspaceService;
}) {
  const { ignoredDomainRepo, workspaceService } = deps;
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const workspace = await workspaceService.getOrThrow();
      res.json(await ignoredDomainRepo.findAll(workspace.id));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { domain } = req.body as { domain?: string };
      if (!domain?.trim()) {
        res.status(400).json({ error: 'domain required' });
        return;
      }
      const workspace = await workspaceService.getOrThrow();
      const created = await ignoredDomainRepo.create(workspace.id, domain.trim());
      res.status(201).json(created);
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await ignoredDomainRepo.delete(parseId(req.params['id']));
      res.status(204).end();
    }),
  );

  return router;
}
