import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

import { parseOptionalNumberQuery, parseTrackQuery } from '../../shared/validation.js';
import type { MemberPublicService } from './member.public.service.js';
import { NotFoundError } from '../../shared/errors.js';
import { badRequest } from '../../shared/http.js';

// 공개 프로필 새로고침은 한 번에 GitHub API 약 3회 + RSS 검사를 쓴다. 아이디별 1분 제한(서비스)만으로는
// 아이디를 바꿔 가며 부르면 토큰(5,000회/시간)이 바닥나 싱크가 멈춘다 → 전체 횟수에 상한을 둔다.
// IP별로 세지 않는 이유: 웹은 Vercel의 /api 프록시를 거쳐 오므로 백엔드가 보는 IP는 모두 Vercel 서버 IP다
// (2026-10-20 nginx 로그). 실제 사용량은 일주일에 몇 건이라 10분 30회는 정상 사용을 막지 않는다
const REFRESH_WINDOW_MS = 10 * 60 * 1000;

export function createMemberPublicRouter(service: MemberPublicService, options: { refreshLimit?: number } = {}) {
  const router = Router();
  const refreshLimiter = rateLimit({
    windowMs: REFRESH_WINDOW_MS,
    limit: options.refreshLimit ?? 30,
    keyGenerator: () => 'all-clients',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // 웹은 429 본문의 remainingSeconds·message를 읽어 카운트다운을 띄운다 → 아이디별 제한과 같은 모양으로 답한다
    handler: (req, res) => {
      const resetTime = (req as typeof req & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
      const remainingSeconds = Math.max(
        1,
        Math.ceil(((resetTime?.getTime() ?? Date.now() + REFRESH_WINDOW_MS) - Date.now()) / 1000),
      );
      res.status(429).json({
        error: 'Rate limited',
        remainingSeconds,
        message: `${remainingSeconds}초 후에 다시 시도해주세요`,
      });
    },
  });

  // GET /members/search?q=&cohort=&track=&role=&limit=&offset=
  router.get('/search', async (req, res) => {
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : undefined;
    const cohort = parseOptionalNumberQuery(req.query['cohort']);
    const track = parseTrackQuery(req.query['track']);
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
    const track = parseTrackQuery(req.query['track']);
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
    const track = parseTrackQuery(req.query['track']);
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
    if (id === undefined) badRequest('invalid post id');
    const result = await service.visitBlogPost(id);
    if (!result) throw new NotFoundError('Blog post not found');
    res.redirect(302, result.url);
  });

  // GET /members/:githubId
  router.get('/:githubId', async (req, res) => {
    const githubId = typeof req.params['githubId'] === 'string' ? req.params['githubId'] : '';
    const member = await service.getMemberDetail(githubId);
    if (!member) throw new NotFoundError('Member not found');
    res.json(member);
  });

  router.get('/:githubId/blog-posts', async (req, res) => {
    const githubId = typeof req.params['githubId'] === 'string' ? req.params['githubId'] : '';
    const posts = await service.getMemberBlogPosts(githubId);
    if (!posts) throw new NotFoundError('Member not found');
    res.json(posts);
  });

  // POST /members/:githubId/refresh
  router.post('/:githubId/refresh', refreshLimiter, async (req, res) => {
    const githubId = typeof req.params['githubId'] === 'string' ? req.params['githubId'] : '';
    // 에러 모양은 어드민과 같이 미들웨어가 정한다({ message }). 429만 웹 카운트다운이 읽는 remainingSeconds를 더 싣는다
    const result = await service.refreshMemberProfile(githubId);
    if ('rateLimited' in result && result.rateLimited) {
      res.status(429).json({
        remainingSeconds: result.remainingSeconds,
        message: `${result.remainingSeconds}초 후에 다시 시도해주세요`,
      });
      return;
    }
    res.json(result.member);
  });

  return router;
}
