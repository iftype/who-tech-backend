import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../app.js';
import prisma from '../../db/prisma.js';
import { SEED_NOW, seedContractData } from '../fixtures/contract-seed.js';

// API 계약 테스트 (ARCHITECTURE_PLAN A-3): 구조 리팩토링 전후로 API 응답이 같아야 한다.
// 고정 시드 데이터에서 각 엔드포인트의 상태 코드와 응답 본문 전체를 스냅샷으로 고정한다.
// 외부 서비스(GitHub·YouTube·RSS)를 부르는 엔드포인트는 여기서 제외하고 unit 라우트 테스트(mock)가 맡는다

const ADMIN_SECRET = 'contract-secret';
process.env['ADMIN_SECRET'] = ADMIN_SECRET;
const auth = { Authorization: `Bearer ${ADMIN_SECRET}` };

const DAY = 24 * 60 * 60 * 1000;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

// /health의 실행 환경 값(가동 시간, 커밋, 릴리즈마다 오르는 버전)은 형태만 비교한다
const ENVIRONMENT_KEYS = new Set(['uptime', 'commit', 'version']);

// 테스트 실행 시각에 생기는 값(@updatedAt, 요청 중 기록)만 자리표시자로 바꾼다. 시드의 고정 날짜는 그대로 비교된다
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, ENVIRONMENT_KEYS.has(key) ? `<${key}>` : normalize(v)]),
    );
  }
  if (typeof value === 'string' && ISO.test(value) && Math.abs(Date.parse(value) - Date.now()) < 2 * DAY) {
    return '<now>';
  }
  return value;
}

// 기간 필터(days=)는 요청 시각 기준이라, 실제 시각으로 보내면 날이 갈수록 시드 글이 창 밖으로 밀린다.
// 그 요청만 Date를 시드 기준 시각으로 고정한다 (타이머는 진짜 그대로 — Prisma·supertest가 쓴다)
const AT_SEED_TIME = /[?&]days=/;
const ONLY_DATE: Parameters<typeof jest.useFakeTimers>[0] = {
  now: SEED_NOW,
  doNotFake: [
    'hrtime',
    'nextTick',
    'performance',
    'queueMicrotask',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'requestIdleCallback',
    'cancelIdleCallback',
    'setImmediate',
    'clearImmediate',
    'setInterval',
    'clearInterval',
    'setTimeout',
    'clearTimeout',
  ],
};

async function snapshot(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, body?: object) {
  let req = request(app)[method](path);
  if (path.startsWith('/admin')) req = req.set(auth);
  if (AT_SEED_TIME.test(path)) jest.useFakeTimers(ONLY_DATE);
  let res: Awaited<typeof req>;
  try {
    res = body ? await req.send(body) : await req;
  } finally {
    jest.useRealTimers();
  }
  // normalize는 실제 시각으로 (시드 시각 근처의 고정 날짜가 '<now>'로 바뀌지 않게)
  return { status: res.status, body: normalize(res.body), location: res.headers['location'] };
}

const realFetch = globalThis.fetch;

beforeAll(async () => {
  // 외부 서비스 호출이 섞이면 응답이 흔들리므로 즉시 실패시킨다
  globalThis.fetch = (input) => {
    throw new Error(`계약 테스트 중 외부 요청: ${String(input instanceof Request ? input.url : input)}`);
  };
  await seedContractData(prisma);
});

afterAll(async () => {
  globalThis.fetch = realFetch;
  await prisma.$disconnect();
});

describe('API contract', () => {
  describe('public GET', () => {
    const paths = [
      '/health',
      '/members/cohorts',
      '/members?q=하루',
      '/members?q=fe-crew-old',
      '/members?cohort=8&track=frontend&role=crew',
      '/members/search?roleGroup=crew&limit=120',
      '/members/search?cohort=8&roleGroup=staff&limit=120&offset=0',
      '/members/search?q=바다&limit=10',
      '/members/feed?days=30&limit=50',
      '/members/feed?limit=2',
      '/members/feed?cohort=8&track=frontend',
      '/members/fe-crew',
      '/members/be-crew',
      '/members/fe-crew-old',
      '/members/team-blog-a',
      '/members/no-such-member',
      '/members/fe-crew/blog-posts',
      '/members/no-such-member/blog-posts',
      '/members/search?limit=abc',
    ];
    it.each(paths)('GET %s', async (path) => {
      expect(await snapshot('get', path)).toMatchSnapshot();
    });
  });

  describe('admin GET', () => {
    const paths = [
      '/admin/status',
      '/admin/workspace',
      '/admin/repos',
      '/admin/repos?status=candidate',
      '/admin/repos/sync-jobs',
      '/admin/blog/sync-jobs',
      '/admin/blog/new-posts?sinceMinutes=999999',
      '/admin/blog/team',
      '/admin/cohort-repos/cohorts',
      '/admin/cohort-repos?cohort=8',
      '/admin/logs',
      '/admin/members',
      '/admin/members?cohort=8&role=crew',
      '/admin/members?q=하루&hasBlog=true',
      '/admin/members?track=backend&page=1&limit=1',
      '/admin/members/cohorts',
      '/admin/members/1',
      '/admin/members/999',
      '/admin/members/1/blog-posts',
      '/admin/persons',
      '/admin/banned-words',
      '/admin/ignored-domains',
      '/admin/archive?cohort=8',
      '/admin/archive?cohort=8&track=frontend&format=markdown',
      '/admin/tecotalk',
      '/admin/tecotalk?cohort=8&matchStatus=matched',
      '/admin/sync/jobs',
    ];
    it.each(paths)('GET %s', async (path) => {
      expect(await snapshot('get', path)).toMatchSnapshot();
    });

    it('GET /admin/status without token is 401', async () => {
      const res = await request(app).get('/admin/status');
      expect({ status: res.status, body: res.body }).toMatchSnapshot();
    });
  });

  // DB만 바꾸는 엔드포인트. 순서대로 실행하며 응답과, 바뀐 결과를 다시 조회한 응답을 함께 고정한다 (위 GET 이후에 실행됨)
  describe('mutations (sequential)', () => {
    type Step = [method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, body?: object];
    const steps: Step[] = [
      ['put', '/admin/workspace', { blogSyncEnabled: false }],
      ['put', '/admin/workspace', { cohortRules: 'bad' }],
      ['get', '/admin/workspace'],

      ['post', '/admin/banned-words', { word: '새금지어' }],
      ['post', '/admin/banned-words', { word: '새금지어' }],
      ['post', '/admin/banned-words', {}],
      ['delete', '/admin/banned-words/1'],
      ['get', '/admin/banned-words'],

      ['post', '/admin/ignored-domains', { domain: 'x.example.com' }],
      ['post', '/admin/ignored-domains', {}],
      ['delete', '/admin/ignored-domains/1'],
      ['get', '/admin/ignored-domains'],

      ['post', '/admin/persons', { displayName: '새사람', note: '메모', memberIds: [2] }],
      ['patch', '/admin/persons/2', { note: '수정한 메모' }],
      ['post', '/admin/persons/2/members/4'],
      ['delete', '/admin/persons/2/members/4'],
      ['delete', '/admin/persons/2'],
      ['get', '/admin/persons'],

      ['post', '/admin/cohort-repos', { cohort: 8, missionRepoId: 2, order: 2, level: 2 }],
      ['post', '/admin/cohort-repos', {}],
      ['patch', '/admin/cohort-repos/3', { order: 5, level: null }],
      ['get', '/admin/cohort-repos?cohort=8'],
      ['delete', '/admin/cohort-repos/3'],
      ['get', '/admin/cohort-repos?cohort=8'],
      ['post', '/admin/cohort-repos/auto-fill', { cohort: 8 }],
      ['post', '/admin/cohort-repos/auto-fill', { cohort: 8 }],
      ['post', '/admin/cohort-repos/auto-fill', {}],
      ['get', '/admin/cohort-repos?cohort=8'],

      ['patch', '/admin/members/2', { manualNickname: '파도', track: 'backend' }],
      ['get', '/admin/members/2'],
      ['patch', '/admin/members/1/cohorts/8', {}],
      ['patch', '/admin/members/1/cohorts/8', { newCohort: 7 }],
      ['get', '/members/fe-crew'],
      ['delete', '/admin/members/4/cohorts/7'],
      ['get', '/admin/members/4'],
      ['post', '/admin/members/1/recalculate-cohorts'],
      ['delete', '/admin/members/1/submissions/2'],
      ['get', '/members/fe-crew'],

      [
        'post',
        '/admin/repos',
        { name: 'new-repo', repoUrl: 'https://github.com/woowacourse/new-repo', track: 'frontend' },
      ],
      ['post', '/admin/repos', { name: 'missing-url' }],
      ['patch', '/admin/repos/4', { status: 'active', tabCategory: 'common' }],
      ['post', '/admin/repos/4/reset-sync'],
      ['get', '/admin/repos'],
      ['delete', '/admin/repos/4'],
      ['get', '/admin/repos'],

      ['patch', '/admin/blog/team/1', { name: '새 이름', enabled: false }],
      ['patch', '/admin/blog/team/abc', { name: 'x' }],
      ['get', '/admin/blog/team'],

      ['post', '/admin/logs', { type: 'note', message: '수동 기록' }],
      ['get', '/admin/logs'],
      ['delete', '/admin/logs'],
      ['get', '/admin/logs'],

      ['get', '/members/blog-posts/1/visit'],
      ['get', '/members/blog-posts/999/visit'],
      ['get', '/members/fe-crew/blog-posts'],

      ['delete', '/admin/sync/jobs/no-such-job'],
      ['delete', '/admin/members/5'],
      ['get', '/admin/members'],
      ['delete', '/admin/members'],
      ['get', '/admin/members'],
    ];

    it.each(steps.map((step, i) => [`${String(i + 1).padStart(2, '0')} ${step[0].toUpperCase()} ${step[1]}`, step]))(
      '%s',
      async (_name, [method, path, body]) => {
        expect(await snapshot(method, path, body)).toMatchSnapshot();
      },
    );
  });
});
