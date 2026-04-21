import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { parseId, parseOptionalNumberQuery } from '../../shared/validation.js';
import type { MemberService } from './member.service.js';

export function createMemberRouter(service: MemberService) {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const q = typeof req.query['q'] === 'string' ? req.query['q'] : undefined;
      const cohort = parseOptionalNumberQuery(req.query['cohort']);
      const hasBlog = req.query['hasBlog'] === 'true' ? true : req.query['hasBlog'] === 'false' ? false : undefined;
      const track = typeof req.query['track'] === 'string' ? req.query['track'] : undefined;
      const role = typeof req.query['role'] === 'string' ? req.query['role'] : undefined;
      res.json(
        await service.listMembers({
          ...(q ? { q } : {}),
          ...(cohort !== undefined ? { cohort } : {}),
          ...(hasBlog !== undefined ? { hasBlog } : {}),
          ...(track ? { track } : {}),
          ...(role ? { role } : {}),
        }),
      );
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = req.body as {
        githubId?: string;
        githubUserId?: number | null;
        nickname?: string | null;
        cohort?: number | null;
        blog?: string | null;
        roles?: string[];
        track?: string | null;
      };
      // githubId 또는 githubUserId 중 하나는 필수
      if (!body.githubId && body.githubUserId == null) {
        res.status(400).json({ error: 'githubId or githubUserId required' });
        return;
      }
      res.status(201).json(await service.createMember({ ...body, githubId: body.githubId ?? '' }));
    }),
  );

  router.get(
    '/:id/blog-posts',
    asyncHandler(async (req, res) => {
      res.json(await service.getMemberBlogPosts(parseId(req.params['id'])));
    }),
  );

  router.post(
    '/refresh-profiles',
    asyncHandler(async (req, res) => {
      const limit = parseOptionalNumberQuery(req.query['limit']) ?? 30;
      const cohort = parseOptionalNumberQuery(req.query['cohort']);
      const staleHours = parseOptionalNumberQuery(req.query['staleHours']);
      res.json(
        await service.refreshWorkspaceProfiles({
          ...(Number.isFinite(limit) ? { limit } : {}),
          ...(cohort !== undefined ? { cohort } : {}),
          ...(staleHours !== undefined ? { staleHours } : {}),
        }),
      );
    }),
  );

  router.post(
    '/:id/refresh-profile',
    asyncHandler(async (req, res) => {
      const result = await service.refreshMemberProfile(parseId(req.params['id']));
      if (result.profileRefreshError) {
        res.status(500).json({ error: result.profileRefreshError, member: result });
      } else {
        res.json(result);
      }
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params['id']);
      const body = req.body as {
        manualNickname?: string | null;
        blog?: string | null;
        roles?: string[];
        cohort?: number;
        track?: string | null;
      };
      res.json(await service.updateMember(id, body));
    }),
  );

  router.patch(
    '/:id/cohorts/:cohort',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params['id']);
      const cohort = parseId(req.params['cohort']);
      const body = req.body as { newCohort: number };
      if (!body.newCohort) {
        res.status(400).json({ error: 'newCohort required' });
        return;
      }
      res.json(await service.changeMemberCohort(id, cohort, body.newCohort));
    }),
  );

  router.delete(
    '/:id/cohorts/:cohort',
    asyncHandler(async (req, res) => {
      const id = parseId(req.params['id']);
      const cohort = parseId(req.params['cohort']);
      res.json(await service.deleteMemberCohort(id, cohort));
    }),
  );

  router.delete(
    '/',
    asyncHandler(async (_req, res) => {
      await service.deleteAllMembers();
      res.status(204).end();
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await service.deleteMember(parseId(req.params['id']));
      res.status(204).end();
    }),
  );

  return router;
}
