import { jest, describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createPersonRouter } from '../../features/person/person.route.js';
import { errorHandler } from '../../shared/middleware/error.js';

type Deps = Parameters<typeof createPersonRouter>[0];
type AsyncMock = ReturnType<typeof jest.fn<(...args: unknown[]) => Promise<unknown>>>;
const asyncMock = (value: unknown): AsyncMock =>
  jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(value);

function makeApp() {
  const personRepo = {
    findAll: asyncMock([{ id: 1 }]),
    create: asyncMock({ id: 5, displayName: '가람' }),
    linkMember: asyncMock(undefined),
    findById: asyncMock({ id: 5, members: [{ id: 10 }] }),
    update: asyncMock({ id: 5 }),
    delete: asyncMock(undefined),
    unlinkMember: asyncMock(undefined),
  };
  const memberRepo = { findByIdWithRelations: asyncMock({ id: 10 }) };
  const workspaceService = { getOrThrow: asyncMock({ id: 1 }) };
  const app = express();
  app.use(express.json());
  app.use('/admin', createPersonRouter({ personRepo, memberRepo, workspaceService } as unknown as Deps));
  app.use(errorHandler);
  return { app, personRepo, memberRepo };
}

describe('admin person routes', () => {
  it('GET /admin/persons should list persons of the workspace', async () => {
    const { app, personRepo } = makeApp();
    expect((await request(app).get('/admin/persons')).body).toEqual([{ id: 1 }]);
    expect(personRepo.findAll).toHaveBeenCalledWith(1);
  });

  describe('POST /admin/persons', () => {
    it('should create a person with only provided fields', async () => {
      const { app, personRepo } = makeApp();

      const res = await request(app).post('/admin/persons').send({ displayName: '가람', note: '' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: 5, displayName: '가람' });
      expect(personRepo.create).toHaveBeenCalledWith(1, { displayName: '가람' });
      expect(personRepo.linkMember).not.toHaveBeenCalled();
    });

    it('should link members and return the reloaded person', async () => {
      const { app, personRepo } = makeApp();

      const res = await request(app)
        .post('/admin/persons')
        .send({ note: '메모', memberIds: [10, 11] });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: 5, members: [{ id: 10 }] });
      expect(personRepo.create).toHaveBeenCalledWith(1, { note: '메모' });
      expect(personRepo.linkMember.mock.calls).toEqual([
        [5, 10],
        [5, 11],
      ]);
    });
  });

  describe('PATCH /admin/persons/:id', () => {
    it('should update only keys present in the body, clearing with null', async () => {
      const { app, personRepo } = makeApp();

      await request(app).patch('/admin/persons/5').send({ displayName: null });
      await request(app).patch('/admin/persons/5').send({ note: '새 메모', displayName: '이름' });
      await request(app).patch('/admin/persons/5').send({});

      expect(personRepo.update.mock.calls).toEqual([
        [5, { displayName: null }],
        [5, { displayName: '이름', note: '새 메모' }],
        [5, {}],
      ]);
    });

    it('should reject an invalid id', async () => {
      const { app, personRepo } = makeApp();
      const res = await request(app).patch('/admin/persons/abc').send({});
      expect(res.status).toBe(400);
      expect(personRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /admin/persons/:id', () => {
    it('should delete a person and reject invalid ids', async () => {
      const { app, personRepo } = makeApp();

      const ok = await request(app).delete('/admin/persons/5');
      const invalid = await request(app).delete('/admin/persons/x');

      expect(ok.body).toEqual({ ok: true });
      expect(personRepo.delete).toHaveBeenCalledWith(5);
      expect(invalid.status).toBe(400);
    });
  });

  describe('member links', () => {
    it('should link a member to a person', async () => {
      const { app, personRepo } = makeApp();

      const res = await request(app).post('/admin/persons/5/members/10');

      expect(res.body).toEqual({ id: 5, members: [{ id: 10 }] });
      expect(personRepo.linkMember).toHaveBeenCalledWith(5, 10);
    });

    it('should reject unknown persons, unknown members, and invalid ids', async () => {
      const { app, personRepo, memberRepo } = makeApp();

      const invalid = await request(app).post('/admin/persons/5/members/abc');
      personRepo.findById.mockResolvedValueOnce(null);
      const noPerson = await request(app).post('/admin/persons/9/members/10');
      memberRepo.findByIdWithRelations.mockResolvedValueOnce(null);
      const noMember = await request(app).post('/admin/persons/5/members/99');

      expect([invalid.status, noPerson.status, noMember.status]).toEqual([400, 400, 400]);
      expect(noPerson.body).toEqual({ message: 'person not found' });
      expect(noMember.body).toEqual({ message: 'member not found' });
      expect(personRepo.linkMember).not.toHaveBeenCalled();
    });

    it('should unlink a member and reject invalid ids', async () => {
      const { app, personRepo } = makeApp();

      const ok = await request(app).delete('/admin/persons/5/members/10');
      const invalid = await request(app).delete('/admin/persons/x/members/10');

      expect(ok.body).toEqual({ id: 5, members: [{ id: 10 }] });
      expect(personRepo.unlinkMember).toHaveBeenCalledWith(10);
      expect(invalid.status).toBe(400);
    });
  });
});
