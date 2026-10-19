import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createDeployRouter } from '../../features/deploy/deploy.route.js';
import { createDeployService, type DeployService } from '../../features/deploy/deploy.service.js';
import { bearerToken, isAdminToken } from '../../shared/middleware/auth.js';
import { createAuthFailureLimiter } from '../../shared/middleware/rate-limit.js';

const ORIGINAL = process.env['ADMIN_SECRET'];

function makeApp(service: DeployService, limiter = createAuthFailureLimiter({ limit: 100 })) {
  const app = express();
  app.use('/admin', createDeployRouter({ service, isAuthorized: isAdminToken, bearerToken, limiter }));
  return app;
}

function fakeService(): DeployService & { start: jest.Mock } {
  return {
    start: jest.fn(() => ({ logFile: '/tmp/who-tech-deploy-1.log' })),
    readRecentLogs: jest.fn(() => []),
  } as never;
}

describe('deploy router', () => {
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env['ADMIN_SECRET'];
    else process.env['ADMIN_SECRET'] = ORIGINAL;
  });

  it('should not start a deploy when ADMIN_SECRET is unset and no header is sent', async () => {
    delete process.env['ADMIN_SECRET'];
    const service = fakeService();
    const res = await request(makeApp(service)).post('/admin/deploy');
    expect(res.status).toBe(401);
    expect(service.start).not.toHaveBeenCalled();
  });

  it('should reject a wrong token', async () => {
    process.env['ADMIN_SECRET'] = 'secret';
    const service = fakeService();
    const res = await request(makeApp(service)).post('/admin/deploy').set('Authorization', 'Bearer wrong');
    expect(res.status).toBe(401);
    expect(service.start).not.toHaveBeenCalled();
  });

  it('should start a deploy with the right token and keep the response shape', async () => {
    process.env['ADMIN_SECRET'] = 'secret';
    const service = fakeService();
    const res = await request(makeApp(service)).post('/admin/deploy').set('Authorization', 'Bearer secret');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'deploy started', logFile: '/tmp/who-tech-deploy-1.log' });
    expect(service.start).toHaveBeenCalledTimes(1);
  });

  it('should block an IP after repeated wrong tokens but not count successful deploys', async () => {
    process.env['ADMIN_SECRET'] = 'secret';
    const service = fakeService();
    const app = makeApp(service, createAuthFailureLimiter({ limit: 3 }));

    for (let i = 0; i < 5; i++) {
      expect((await request(app).post('/admin/deploy').set('Authorization', 'Bearer secret')).status).toBe(200);
    }
    for (let i = 0; i < 3; i++) {
      expect((await request(app).post('/admin/deploy').set('Authorization', 'Bearer wrong')).status).toBe(401);
    }
    const blocked = await request(app).post('/admin/deploy').set('Authorization', 'Bearer secret');
    expect(blocked.status).toBe(429);
    expect(service.start).toHaveBeenCalledTimes(5);
  });

  it('should protect the logs endpoint too', async () => {
    delete process.env['ADMIN_SECRET'];
    const res = await request(makeApp(fakeService())).get('/admin/deploy/logs');
    expect(res.status).toBe(401);
  });
});

describe('createDeployService', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'deploy-logs-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('should spawn bash with the script path without a shell', () => {
    const unref = jest.fn();
    const spawn = jest.fn(() => ({ unref }));
    const service = createDeployService({ scriptPath: '/app/scripts/deploy.sh', spawn: spawn as never, now: () => 42 });
    expect(service.start()).toEqual({ logFile: '/tmp/who-tech-deploy-42.log' });
    expect(spawn).toHaveBeenCalledWith('bash', ['/app/scripts/deploy.sh'], {
      detached: true,
      stdio: 'ignore',
      shell: false,
    });
    expect(unref).toHaveBeenCalled();
  });

  it('should return the last 30 lines of the newest 10 deploy logs, newest first', () => {
    for (let i = 0; i < 12; i++) {
      const file = join(dir, `who-tech-deploy-${i}.log`);
      writeFileSync(file, Array.from({ length: 40 }, (_, n) => `log${i}-line${n}`).join('\n') + '\n');
      utimesSync(file, 1_000 + i, 1_000 + i);
    }
    writeFileSync(join(dir, 'unrelated.log'), 'x');
    writeFileSync(join(dir, 'who-tech-deploy-x.lock'), 'x');

    const logs = createDeployService({ scriptPath: 's', logDir: dir }).readRecentLogs();

    expect(logs).toHaveLength(10);
    expect(logs[0]?.file).toBe(join(dir, 'who-tech-deploy-11.log'));
    expect(logs[9]?.file).toBe(join(dir, 'who-tech-deploy-2.log'));
    const lines = logs[0]?.content.split('\n') ?? [];
    expect(lines[0]).toBe('log11-line10');
    expect(lines[29]).toBe('log11-line39');
    expect(logs[0]?.content.endsWith('\n')).toBe(true);
  });

  it('should not run shell code hidden in a log file name', () => {
    const evil = join(dir, 'who-tech-deploy-$(touch pwned).log');
    writeFileSync(evil, 'ok\n');
    const logs = createDeployService({ scriptPath: 's', logDir: dir }).readRecentLogs();
    expect(logs).toEqual([{ file: evil, content: 'ok\n' }]);
  });

  it('should return an empty list when the log directory is missing', () => {
    expect(createDeployService({ scriptPath: 's', logDir: join(dir, 'nope') }).readRecentLogs()).toEqual([]);
  });
});
