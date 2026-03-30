import { Router } from 'express';
import { asyncHandler, badRequest } from '../../shared/http.js';
import type { PersonRepository } from '../../db/repositories/person.repository.js';
import type { MemberRepository } from '../../db/repositories/member.repository.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';

export function createPersonRouter(deps: {
  personRepo: PersonRepository;
  memberRepo: MemberRepository;
  workspaceService: WorkspaceService;
}) {
  const { personRepo, memberRepo, workspaceService } = deps;
  const router = Router();

  // GET /admin/persons
  router.get(
    '/persons',
    asyncHandler(async (_req, res) => {
      const workspace = await workspaceService.getOrThrow();
      res.json(await personRepo.findAll(workspace.id));
    }),
  );

  // POST /admin/persons  { displayName?, note?, memberIds?: number[] }
  router.post(
    '/persons',
    asyncHandler(async (req, res) => {
      const workspace = await workspaceService.getOrThrow();
      const body = req.body as { displayName?: string; note?: string; memberIds?: number[] };

      const createData: { displayName?: string; note?: string } = {};
      if (body.displayName) createData.displayName = body.displayName;
      if (body.note) createData.note = body.note;

      const person = await personRepo.create(workspace.id, createData);

      if (body.memberIds?.length) {
        await Promise.all(body.memberIds.map((mid) => personRepo.linkMember(person.id, mid)));
        res.status(201).json(await personRepo.findById(person.id));
        return;
      }

      res.status(201).json(person);
    }),
  );

  // PATCH /admin/persons/:id  { displayName?, note? }
  router.patch(
    '/persons/:id',
    asyncHandler(async (req, res) => {
      const id = Number(req.params['id']);
      if (isNaN(id)) {
        badRequest('invalid id');
        return;
      }
      const body = req.body as { displayName?: string | null; note?: string | null };
      const updateData: { displayName?: string | null; note?: string | null } = {};
      if ('displayName' in body) updateData.displayName = body.displayName ?? null;
      if ('note' in body) updateData.note = body.note ?? null;
      res.json(await personRepo.update(id, updateData));
    }),
  );

  // DELETE /admin/persons/:id
  router.delete(
    '/persons/:id',
    asyncHandler(async (req, res) => {
      const id = Number(req.params['id']);
      if (isNaN(id)) {
        badRequest('invalid id');
        return;
      }
      await personRepo.delete(id);
      res.json({ ok: true });
    }),
  );

  // POST /admin/persons/:id/members/:memberId  — 멤버를 Person에 연결
  router.post(
    '/persons/:id/members/:memberId',
    asyncHandler(async (req, res) => {
      const personId = Number(req.params['id']);
      const memberId = Number(req.params['memberId']);
      if (isNaN(personId) || isNaN(memberId)) {
        badRequest('invalid id');
        return;
      }

      const person = await personRepo.findById(personId);
      if (!person) {
        badRequest('person not found');
        return;
      }

      const member = await memberRepo.findByIdWithRelations(memberId);
      if (!member) {
        badRequest('member not found');
        return;
      }

      await personRepo.linkMember(personId, memberId);
      res.json(await personRepo.findById(personId));
    }),
  );

  // DELETE /admin/persons/:id/members/:memberId  — 연결 해제
  router.delete(
    '/persons/:id/members/:memberId',
    asyncHandler(async (req, res) => {
      const personId = Number(req.params['id']);
      const memberId = Number(req.params['memberId']);
      if (isNaN(personId) || isNaN(memberId)) {
        badRequest('invalid id');
        return;
      }

      await personRepo.unlinkMember(memberId);
      res.json(await personRepo.findById(personId));
    }),
  );

  return router;
}
