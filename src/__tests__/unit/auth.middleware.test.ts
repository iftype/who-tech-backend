import { describe, it, expect, afterEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { adminAuth, isAdminToken } from '../../shared/middleware/auth.js';

const ORIGINAL = process.env['ADMIN_SECRET'];

function makeApp() {
  const app = express();
  app.use('/admin', adminAuth);
  app.get('/admin/ping', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('adminAuth', () => {
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env['ADMIN_SECRET'];
    else process.env['ADMIN_SECRET'] = ORIGINAL;
  });

  it('should reject every request when ADMIN_SECRET is not set', async () => {
    delete process.env['ADMIN_SECRET'];
    expect((await request(makeApp()).get('/admin/ping')).status).toBe(401);
    expect((await request(makeApp()).get('/admin/ping').set('Authorization', 'Bearer ')).status).toBe(401);
    expect(isAdminToken(undefined)).toBe(false);
  });

  it('should reject a wrong token', async () => {
    process.env['ADMIN_SECRET'] = 'secret';
    const res = await request(makeApp()).get('/admin/ping').set('Authorization', 'Bearer nope');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
  });

  it('should reject a token that only shares a prefix', () => {
    process.env['ADMIN_SECRET'] = 'secret';
    expect(isAdminToken('secret2')).toBe(false);
    expect(isAdminToken('secre')).toBe(false);
  });

  it('should pass with the right header token', async () => {
    process.env['ADMIN_SECRET'] = 'secret';
    const res = await request(makeApp()).get('/admin/ping').set('Authorization', 'Bearer secret');
    expect(res.status).toBe(200);
  });

  it('should pass with the right query token (EventSource)', async () => {
    process.env['ADMIN_SECRET'] = 'secret';
    const res = await request(makeApp()).get('/admin/ping?token=secret');
    expect(res.status).toBe(200);
  });
});
