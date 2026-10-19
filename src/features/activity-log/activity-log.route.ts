import { Router } from 'express';

import type { ActivityLogService } from './activity-log.service.js';

export function createActivityLogRouter(service: ActivityLogService) {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await service.getLogs());
  });

  router.post('/', async (req, res) => {
    const { type, message } = req.body as { type: string; message: string };
    res.json(await service.addLog(type, message));
  });

  router.delete('/', async (_req, res) => {
    await service.clearLogs();
    res.status(204).end();
  });

  return router;
}
