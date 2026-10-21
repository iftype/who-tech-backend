import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { HttpError } from '../../shared/http.js';
import { errorHandler } from '../../shared/middleware/error.js';

function makeApp(handler: express.RequestHandler) {
  const app = express();
  app.use(express.json({ limit: '10b' }));
  app.put('/x', handler);
  app.use(errorHandler);
  return app;
}

const ok: express.RequestHandler = (_req, res) => {
  res.json({});
};

describe('errorHandler', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('should answer 400 for a malformed JSON body', async () => {
    const res = await request(makeApp(ok)).put('/x').set('content-type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });

  it('should keep other client errors from body parsing (413)', async () => {
    const res = await request(makeApp(ok))
      .put('/x')
      .send({ long: 'x'.repeat(50) });
    expect(res.status).toBe(413);
  });

  it('should use the HttpError status and message', async () => {
    const res = await request(
      makeApp(() => {
        throw new HttpError(404, 'not found');
      }),
    ).put('/x');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'not found' });
  });

  it('should hide unexpected errors behind a 500', async () => {
    const res = await request(
      makeApp(() => {
        throw new Error('db exploded');
      }),
    ).put('/x');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'internal server error' });
  });

  it('should catch a rejected async handler without a wrapper (Express 5)', async () => {
    const res = await request(
      makeApp(async () => {
        throw new HttpError(409, 'conflict');
      }),
    ).put('/x');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'conflict' });
  });

  it('should answer 404 when Prisma reports a missing row (P2025) instead of 500', async () => {
    const app = express();
    app.get('/x', () => {
      const error = Object.assign(new Error('Record to update not found.'), { code: 'P2025' });
      throw error;
    });
    app.use(errorHandler);

    const res = await request(app).get('/x');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'not found' });
  });
});
