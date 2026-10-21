import { Router } from 'express';
import type { Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { DeployService } from './deploy.service.js';

// GitHub Actions가 CI 성공 후 호출하는 배포 트리거. 어드민 미들웨어보다 앞에 붙으므로 헤더 토큰을 직접 검사한다.
// 비밀키 하나로 지키므로 실패(4xx)한 시도만 IP별로 센다(15분 10회). 정상 배포는 세지 않아 막히지 않는다
export function createDeployRouter(deps: {
  service: DeployService;
  isAuthorized: (token: string | undefined) => boolean;
  bearerToken: (req: Request) => string | undefined;
  failureLimit?: number;
}) {
  const { service, isAuthorized, bearerToken, failureLimit = 10 } = deps;
  const router = Router();

  router.use(
    '/deploy',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: failureLimit,
      skipSuccessfulRequests: true,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: 'Too many requests' },
    }),
  );

  router.post('/deploy', (req, res): void => {
    if (!isAuthorized(bearerToken(req))) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const { logFile } = service.start();
    res.json({ ok: true, message: 'deploy started', logFile });
  });

  router.get('/deploy/logs', (req, res): void => {
    if (!isAuthorized(bearerToken(req))) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    res.json(service.readRecentLogs());
  });

  return router;
}
