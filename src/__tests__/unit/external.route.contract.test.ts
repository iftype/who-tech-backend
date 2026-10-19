import { jest, describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createSyncRouter } from '../../features/sync/sync.route.js';
import { createBlogRouter } from '../../features/blog/blog.route.js';
import { createRepoRouter } from '../../features/repo/repo.route.js';
import { createTecoTalkRouter } from '../../features/tecotalk/tecotalk.route.js';
import { createMemberRouter } from '../../features/member/member.route.js';
import { createMemberPublicRouter } from '../../features/member/member.public.route.js';
import { errorHandler } from '../../shared/middleware/error.js';

// 외부 서비스(GitHub·YouTube·RSS)를 부르는 엔드포인트의 라우트 계약 (ARCHITECTURE_PLAN A-3).
// DB만 쓰는 엔드포인트는 integration/api-contract.int.test.ts가 실제 DB로 고정하고,
// 여기서는 서비스를 가짜로 바꿔 상태 코드·응답 본문·입력 검증·서비스에 넘기는 인자를 고정한다.
// SSE 스트림 엔드포인트는 sync.route.test.ts(SSE 헬퍼)가 맡는다

type Calls = Record<string, unknown[][]>;
// 단계별로 특정 서비스 메서드의 결과를 바꾼다 (Error면 throw)
type Overrides = Record<string, unknown>;

// 어떤 메서드를 불러도 { from: 메서드명 }(또는 overrides 값)을 돌려주고 호출 인자를 기록하는 가짜 서비스
function fakeService(calls: Calls, prefix: string, overrides: Overrides) {
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop !== 'string') return undefined;
        return jest.fn(async (...args: unknown[]) => {
          const key = `${prefix}.${prop}`;
          (calls[key] ??= []).push(args);
          if (!(key in overrides)) return { from: key };
          const value = overrides[key];
          if (value instanceof Error) throw value;
          return value;
        });
      },
    },
  );
}

function makeApp(overrides: Overrides) {
  const calls: Calls = {};
  const fake = (prefix: string) => fakeService(calls, prefix, overrides) as never;
  const sync = fake('sync');
  const app = express();
  app.use(express.json());
  app.use('/members', createMemberPublicRouter(fake('memberPublic')));
  app.use('/admin/repos', createRepoRouter(fake('repo'), sync));
  app.use('/admin', createSyncRouter(sync));
  app.use('/admin', createBlogRouter(fake('blog')));
  app.use('/admin/members', createMemberRouter(fake('member')));
  app.use('/admin/tecotalk', createTecoTalkRouter(fake('tecotalk')));
  app.use(errorHandler);
  return { app, calls };
}

type Step = [method: 'get' | 'post' | 'delete', path: string, body?: object, overrides?: Overrides];

const REFRESH = 'memberPublic.refreshMemberProfile';

const steps: Step[] = [
  ['post', '/members/fe-crew/refresh', undefined, { [REFRESH]: { member: { githubId: 'fe-crew' } } }],
  ['post', '/members/fe-crew/refresh', undefined, { [REFRESH]: { rateLimited: true, remainingSeconds: 42 } }],
  ['post', '/members/ghost/refresh', undefined, { [REFRESH]: new Error('Member not found') }],
  ['post', '/members/fe-crew/refresh', undefined, { [REFRESH]: new Error('GitHub down') }],
  ['get', '/admin/github-status'],
  ['post', '/admin/sync', {}],
  ['post', '/admin/sync', { cohort: 8 }],
  ['post', '/admin/sync/continuous', {}],
  ['post', '/admin/sync/cohort-repos', { cohort: 8 }],
  ['post', '/admin/sync/cohort-repos', {}],
  ['post', '/admin/sync/jobs', { cohort: 8 }],
  ['post', '/admin/sync/jobs', {}],
  ['post', '/admin/sync/jobs', { type: 'workspace' }],
  ['post', '/admin/sync/jobs', { type: 'repo', repoId: 1 }],
  ['post', '/admin/blog/sync', {}],
  ['get', '/admin/blog/sync-jobs/job-1'],
  ['post', '/admin/blog/team/sync'],
  ['post', '/admin/blog/backfill', {}],
  ['post', '/admin/repos/discover'],
  ['post', '/admin/repos/1/sync', {}],
  ['post', '/admin/repos/abc/sync', {}],
  // GET /admin/repos/sync-jobs/:id 는 실제 큐로 repo.sync-jobs.route.test.ts 가 고정한다
  ['post', '/admin/tecotalk/sync', {}],
  ['post', '/admin/tecotalk/sync', { mode: 'full' }],
  ['post', '/admin/members', { githubId: 'new-crew', cohort: 8, roles: ['crew'], track: 'frontend' }],
  ['post', '/admin/members', { nickname: 'no-id' }],
  ['post', '/admin/members/refresh-profiles', {}],
  ['post', '/admin/members/1/refresh-profile'],
  ['post', '/admin/members/1/resync-submissions'],
];

describe('external-service routes contract', () => {
  it.each(steps.map((step) => [`${step[0].toUpperCase()} ${step[1]} ${JSON.stringify(step[2] ?? null)}`, step]))(
    '%s',
    async (_name, [method, path, body, overrides]) => {
      const { app, calls } = makeApp(overrides ?? {});
      let req = request(app)[method](path);
      if (body) req = req.send(body);
      const res = await req;
      expect({ status: res.status, body: res.body, calls }).toMatchSnapshot();
    },
  );
});
