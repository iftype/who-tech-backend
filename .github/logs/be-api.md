# be-api — 공개 API·데이터 모델·스키마

---

## 2026-04-03

**운영진 트랙 집계 수정**

- **왜**: `submissions`에서만 트랙 추출 → 제출 이력 없는 코치/리뷰어는 `tracks: []`
- **핵심 파일**: `src/features/member/member.public.service.ts`
- **결정**: `[Member.track, ...submissions tracks]`로 합산 (목록·상세·피드 3곳 모두)

---

## 2026-03-30

**Person 마스터 테이블**

- **왜**: 같은 인물이 여러 GitHub ID로 등록된 경우 통합 관리
- **핵심 파일**: `schema.prisma`, `src/db/repositories/person.repository.ts`, `src/features/person/person.route.ts`
- **결정**: Person(id, displayName?, note?, workspaceId) + Member.personId FK, 어드민 CRUD API 제공
- **마이그레이션**: `20260330002531_add_person_master_table`

**blogPostsLatest 잔재 제거**

- **왜**: `BlogPostLatest` 모델 삭제 후 `member.repository.ts` 미갱신으로 멤버 삭제 트랜잭션 전체 실패
- **핵심 파일**: `src/db/repositories/member.repository.ts`, `src/features/member/member.public.service.ts`, `src/features/member/member.service.ts`
- **결정**: `blogPostsLatest` → `blogPosts: { orderBy: { publishedAt: 'desc' }, take: 10 }`

---

## 2026-03-28

**공개 API 신규 구현**

- **왜**: 프론트엔드용 인증 불필요 API
- **핵심 파일**: `src/features/member/member.public.service.ts`, `src/features/member/member.public.route.ts`
- **결정**: `GET /members`, `GET /members/feed`, `GET /members/:githubId` (archive + blogPosts 포함)

**Member.lastPostedAt 추가**

- RSS 수집 시 최근 글 `publishedAt` 저장
- **마이그레이션**: `20260328210000_add_member_last_posted_at`

**Member.avatarUrl 추가**

- GitHub profile `avatar_url` sync/backfill 시 저장

**MissionRepo.tabCategory 추가**

- 값: `base | common | excluded | precourse`

**Prisma 마이그레이션 재정리**

- **왜**: 누적 마이그레이션이 현재 스키마와 불일치 → Prisma Client 쿼리 실패
- **결정**: baseline migration 1개(`20260328190000_baseline`)로 재정리, 이후 2026-03-29에 전면 교체

---

## 2026-03-27

**기수별 닉네임 정규식 지원 (이후 제거됨)**

- `MissionRepo.cohortRegexRules` JSON 필드 (2026-03-31에 스키마에서 삭제)

**MissionRepo.track nullable로 변경**

- 공통/협업 미션 track → `null`

**서비스 계층 도입 (PR #17)**

- **결정**: `feature.route` → `feature.service` → `db/repository` 레이어링
- `app.ts`를 composition root로: PrismaClient + octokit 단일 생성 후 repo → service → router 조립
- factory 함수 패턴: `createXxxService(deps)`, `createXxxRouter(service)`

---

## 2026-03-26

**백엔드 v1 초기 구현**

- `Workspace`, `Member`, `MissionRepo`, `Submission` 스키마
- 기수 판별: `created_at` 연도 → `cohortRules` JSON 매핑
- `Cohort / Role / MemberCohort` 정규화 (기수/역할 분리)
- `npm run seed`: Role + Workspace 생성
