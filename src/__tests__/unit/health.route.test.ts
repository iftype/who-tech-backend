import { describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createHealthRouter } from '../../features/health/health.route.js';

function makeApp(pingDb: () => Promise<void>) {
  const app = express();
  app.use('/health', createHealthRouter({ version: '1.2.3', commit: 'abc1234', pingDb }));
  return app;
}

describe('GET /health', () => {
  it('should return 200 with version and commit when DB is reachable', async () => {
    const res = await request(makeApp(async () => {})).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', version: '1.2.3', commit: 'abc1234' });
    expect(typeof res.body.uptime).toBe('number');
  });

  it('should return 503 without error details when DB ping fails', async () => {
    const res = await request(
      makeApp(async () => {
        throw new Error('SQLITE_CANTOPEN: /secret/path/dev.db');
      }),
    ).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', db: 'unreachable', version: '1.2.3', commit: 'abc1234' });
    expect(JSON.stringify(res.body)).not.toContain('/secret/path');
  });
});
