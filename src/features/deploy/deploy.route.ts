import { Router } from 'express';
import type { Request, RequestHandler } from 'express';
import type { DeployService } from './deploy.service.js';

// GitHub Actions가 CI 성공 후 호출하는 배포 트리거. 어드민 미들웨어보다 앞에 붙으므로 헤더 토큰을 직접 검사한다
export function createDeployRouter(deps: {
  service: DeployService;
  isAuthorized: (token: string | undefined) => boolean;
  bearerToken: (req: Request) => string | undefined;
  limiter: RequestHandler;
}) {
  const { service, isAuthorized, bearerToken, limiter } = deps;
  const router = Router();

  router.post('/deploy', limiter, (req, res): void => {
    if (!isAuthorized(bearerToken(req))) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { logFile } = service.start();
    res.json({ ok: true, message: 'deploy started', logFile });
  });

  router.get('/deploy/logs', limiter, (req, res): void => {
    if (!isAuthorized(bearerToken(req))) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json(service.readRecentLogs());
  });

  return router;
}
