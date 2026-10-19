import { Router } from 'express';

import { parseOptionalNumberQuery } from '../../shared/validation.js';
import type { MemberPublicService } from './member.public.service.js';
import { NotFoundError } from '../../shared/errors.js';

export function createMemberPublicRouter(service: MemberPublicService) {
  const router = Router();

  // GET /members/search?q=&cohort=&track=&role=&limit=&offset=
  router.get('/search', async (req, res) => {
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : undefined;
    const cohort = parseOptionalNumberQuery(req.query['cohort']);
    const track = typeof req.query['track'] === 'string' ? req.query['track'] : undefined;
    const role = typeof req.query['role'] === 'string' ? req.query['role'] : undefined;
    const roleGroup =
      typeof req.query['roleGroup'] === 'string' ? (req.query['roleGroup'] as 'crew' | 'staff') : undefined;
    const limitValue = parseOptionalNumberQuery(req.query['limit']);
    const offsetValue = parseOptionalNumberQuery(req.query['offset']);
    const limit = Math.min(Math.max(limitValue ?? 120, 1), 200);
    const offset = Math.max(offsetValue ?? 0, 0);

    res.json(
      await service.searchMembersPage(
        {
          ...(q ? { q } : {}),
          ...(cohort !== undefined ? { cohort } : {}),
          ...(track ? { track } : {}),
          ...(role ? { role } : {}),
          ...(roleGroup ? { roleGroup } : {}),
        },
        { limit, offset },
      ),
    );
  });

  // GET /members?q=&cohort=&track=&role=
  router.get('/', async (req, res) => {
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : undefined;
    const cohort = parseOptionalNumberQuery(req.query['cohort']);
    const track = typeof req.query['track'] === 'string' ? req.query['track'] : undefined;
    const role = typeof req.query['role'] === 'string' ? req.query['role'] : undefined;
    const roleGroup =
      typeof req.query['roleGroup'] === 'string' ? (req.query['roleGroup'] as 'crew' | 'staff') : undefined;
    res.json(
      await service.searchMembers({
        ...(q ? { q } : {}),
        ...(cohort !== undefined ? { cohort } : {}),
        ...(track ? { track } : {}),
        ...(role ? { role } : {}),
        ...(roleGroup ? { roleGroup } : {}),
      }),
    );
  });

  router.get('/feed', async (req, res) => {
    const cohort = parseOptionalNumberQuery(req.query['cohort']);
    const track = typeof req.query['track'] === 'string' ? req.query['track'] : undefined;
    const days = parseOptionalNumberQuery(req.query['days']);
    const cursor = typeof req.query['cursor'] === 'string' ? req.query['cursor'] : undefined;
    const limit = days != null && days <= 7 ? 20 : 30;

    const result = await service.getFeed({
      ...(cohort !== undefined ? { cohort } : {}),
      ...(track ? { track } : {}),
      ...(days != null ? { days } : {}),
      limit,
      ...(cursor ? { cursor } : {}),
    });

    res.json(result);
  });
  router.get('/cohorts', async (req, res) => {
    res.json(await service.getCohorts());
  });

  // GET /members/blog-posts/:id/visit — 클릭(조회)수 +1 후 블로그 글로 리다이렉트
  router.get('/blog-posts/:id/visit', async (req, res) => {
    const id = parseOptionalNumberQuery(req.params['id']);
    if (id === undefined) {
      res.status(400).json({ error: 'invalid post id' });
      return;
    }
    const result = await service.visitBlogPost(id);
    if (!result) {
      res.status(404).json({ error: 'Blog post not found' });
      return;
    }
    res.redirect(302, result.url);
  });

  // GET /members/:githubId
  router.get('/:githubId', async (req, res) => {
    const githubId = typeof req.params['githubId'] === 'string' ? req.params['githubId'] : '';
    const member = await service.getMemberDetail(githubId);
    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }
    res.json(member);
  });

  router.get('/:githubId/blog-posts', async (req, res) => {
    const githubId = typeof req.params['githubId'] === 'string' ? req.params['githubId'] : '';
    const posts = await service.getMemberBlogPosts(githubId);
    if (!posts) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }
    res.json(posts);
  });

  // POST /members/:githubId/refresh
  router.post('/:githubId/refresh', async (req, res) => {
    const githubId = typeof req.params['githubId'] === 'string' ? req.params['githubId'] : '';
    try {
      const result = await service.refreshMemberProfile(githubId);
      if ('rateLimited' in result && result.rateLimited) {
        res.status(429).json({
          error: 'Rate limited',
          remainingSeconds: result.remainingSeconds,
          message: `${result.remainingSeconds}초 후에 다시 시도해주세요`,
        });
        return;
      }
      res.json(result.member);
    } catch (error) {
      // 공개 API는 { error } 모양으로 답한다 (어드민의 { message }와 다름 — 계약 유지)
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
