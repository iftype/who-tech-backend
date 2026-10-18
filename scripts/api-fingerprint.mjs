#!/usr/bin/env node
// 운영 API 응답 지문 (ARCHITECTURE_PLAN A-3). 구조 PR 배포 전후에 찍어 비교한다:
//   node scripts/api-fingerprint.mjs > before.txt   # 배포 전
//   node scripts/api-fingerprint.mjs > after.txt    # 배포 후
//   diff before.txt after.txt                       # 비어 있어야 함
// 동기화·조회수 집계로 데이터가 바뀌면 차이가 날 수 있으므로 배포 직전·직후에 바로 찍고, 차이가 나면 해당 응답을 직접 비교한다.
// API_BASE(기본 https://iftype.site), ADMIN_SECRET이 있으면 어드민 GET도 포함한다
import { createHash } from 'node:crypto';

const BASE = process.env['API_BASE'] ?? 'https://iftype.site';
const ADMIN_SECRET = process.env['ADMIN_SECRET'];

const PUBLIC_PATHS = [
  '/members/cohorts',
  '/members/search?roleGroup=crew&limit=120',
  '/members/search?roleGroup=staff&limit=120',
  '/members/search?cohort=8&roleGroup=crew&limit=120&offset=0',
  '/members/search?cohort=7&roleGroup=crew&limit=120&offset=0',
  '/members/search?cohort=6&roleGroup=crew&limit=120&offset=0',
  '/members?q=%EC%BD%98%ED%8B%B0',
  '/members/feed?days=30&limit=50',
  '/members/feed?limit=50',
  '/members/iftype',
  '/members/iftype/blog-posts',
  '/members/no-such-member',
  // 이전 GitHub ID로 검색 (F-1: JSON 컬럼과 테이블 불일치 확인용)
  '/members?q=EveryPine',
  '/members?q=egaeng09',
  '/members?q=YuyoungRhee',
  '/members?q=iamjooon2',
];

const ADMIN_PATHS = [
  '/admin/workspace',
  '/admin/repos',
  '/admin/cohort-repos/cohorts',
  '/admin/cohort-repos?cohort=8',
  '/admin/members/cohorts',
  '/admin/persons',
  '/admin/banned-words',
  '/admin/ignored-domains',
  '/admin/blog/team',
  '/admin/archive?cohort=8',
  '/admin/tecotalk?cohort=8',
];

async function fingerprint(path, headers = {}) {
  const res = await fetch(`${BASE}${path}`, { headers });
  const body = await res.text();
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 16);
  return `${res.status} ${hash} ${path}`;
}

const lines = [];
for (const path of PUBLIC_PATHS) lines.push(await fingerprint(path));
if (ADMIN_SECRET) {
  for (const path of ADMIN_PATHS) lines.push(await fingerprint(path, { Authorization: `Bearer ${ADMIN_SECRET}` }));
}
console.log(lines.join('\n'));
