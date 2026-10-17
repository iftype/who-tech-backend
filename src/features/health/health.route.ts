import { Router } from 'express';

export interface HealthDeps {
  version: string;
  commit: string;
  pingDb: () => Promise<void>;
}

// 배포 검증·업타임 체크용. DB 오류 세부 내용은 공개 응답에 넣지 않는다
export function createHealthRouter({ version, commit, pingDb }: HealthDeps) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      await pingDb();
      res.json({ status: 'ok', version, commit, uptime: Math.round(process.uptime()) });
    } catch (e) {
      const reason = e instanceof Error ? e.name : 'UnknownError';
      res.status(503).json({ status: 'error', db: 'unreachable', reason, version, commit });
    }
  });

  return router;
}
