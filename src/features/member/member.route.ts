import { Router } from 'express';
import { NotFoundError } from '../../shared/errors.js';

import { badRequest } from '../../shared/http.js';
import { parseId, parseOptionalNumberQuery } from '../../shared/validation.js';
import type { MemberService } from './member.service.js';
import type { SyncAdminService } from '../sync/index.js';

export function createMemberRouter(service: MemberService, syncAdminService: SyncAdminService) {
  const router = Router();

  router.get('/', async (req, res) => {
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
  });

  router.post('/', async (req, res) => {
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
      badRequest('githubId or githubUserId required');
    }
    res.status(201).json(await service.createMember({ ...body, githubId: body.githubId ?? '' }));
  });

  router.get('/cohorts', async (_req, res) => {
    res.json(await service.listMemberCohorts());
  });

  router.get('/:id', async (req, res) => {
    const member = await service.get(parseId(req.params['id']));
    if (!member) throw new NotFoundError('member not found');
    res.json(member);
  });

  router.get('/:id/blog-posts', async (req, res) => {
    const page = parseOptionalNumberQuery(req.query['page']) ?? 1;
    res.json(await service.getMemberBlogPosts(parseId(req.params['id']), page));
  });

  router.post('/refresh-profiles', async (req, res) => {
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
  });

  router.post('/:id/refresh-profile', async (req, res) => {
    const result = await service.refreshMemberProfile(parseId(req.params['id']));
    if (result.profileRefreshError) {
      res.status(500).json({ message: result.profileRefreshError, member: result });
    } else {
      res.json(result);
    }
  });

  router.patch('/:id', async (req, res) => {
    const id = parseId(req.params['id']);
    const body = req.body as {
      manualNickname?: string | null;
      blog?: string | null;
      roles?: string[];
      cohort?: number;
      track?: string | null;
      cohortLocked?: boolean;
    };
    res.json(await service.updateMember(id, body));
  });

  router.patch('/:id/cohorts/:cohort', async (req, res) => {
    const id = parseId(req.params['id']);
    const cohort = parseId(req.params['cohort']);
    const body = req.body as { newCohort: number };
    if (!body.newCohort) badRequest('newCohort required');
    res.json(await service.changeMemberCohort(id, cohort, body.newCohort));
  });

  router.delete('/:id/cohorts/:cohort', async (req, res) => {
    const id = parseId(req.params['id']);
    const cohort = parseId(req.params['cohort']);
    res.json(await service.deleteMemberCohort(id, cohort));
  });

  router.post('/:id/recalculate-cohorts', async (req, res) => {
    res.json(await service.recalculateMemberCohorts(parseId(req.params['id'])));
  });

  router.delete('/', async (_req, res) => {
    await service.deleteAllMembers();
    res.status(204).end();
  });

  router.delete('/:id', async (req, res) => {
    await service.deleteMember(parseId(req.params['id']));
    res.status(204).end();
  });

  router.delete('/:id/submissions/:submissionId', async (req, res) => {
    const memberId = parseId(req.params['id']);
    const submissionId = parseId(req.params['submissionId']);
    await service.deleteSubmission(memberId, submissionId);
    res.status(204).end();
  });

  // 멤버 한 명의 PR 재수집도 싱크 큐(GitHub 레인)를 거친다. 240초 안에 끝나면 200 + 결과, 아니면 202 + 작업
  router.post('/:id/resync-submissions', async (req, res) => {
    const member = await service.get(parseId(req.params['id']));
    if (!member) throw new NotFoundError('member not found');
    const outcome = await syncAdminService.requestMemberSync(member.githubId);
    if (outcome.done) res.json(outcome.result);
    else res.status(202).json(outcome.job);
  });

  return router;
}
