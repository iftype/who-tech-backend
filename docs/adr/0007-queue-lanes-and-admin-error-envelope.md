# 0007 싱크 큐 하나에 레인 2개, 어드민 에러는 `{message}` 하나

- 상태: 적용 (2026-10-21, #215 · #216 · #217)

## 배경

2026-10-21 전수 감사(백엔드 1갈래)에서 찾은 것.

- 싱크 실행 경로가 셋이었다: 싱크 큐(`sync.queue.ts`), `blog.admin.service.ts` 안의 사설 잡 저장소(`syncJobs` Map·`runningJobId`·6시간 `cleanupJobs`·`serializeJob`), 멤버 PR 재수집은 라우트에서 인라인 실행. 진행률 타입도 둘(`SyncProgress`, `BlogSyncJob['progress']`)
- 블로그 싱크(30분 cron)는 자기 저장소에서 돌아 큐의 TTL·취소·구독·활동 로그를 쓰지 못했고, 큐에 넣자니 긴 GitHub 전체 싱크 뒤에서 기다려야 했다
- 어드민 라우트 25곳이 `res.status(4xx).json({ error })`로 응답하고 `errorHandler`는 `{ message }`를 내보내 어드민 SPA(`message`만 읽음)가 서버 메시지를 못 봤다. Prisma P2025(없는 레코드)는 500, person 링크의 없는 대상은 400
- 어드민 "기수 추가"가 `{ cohort }`만 보내 서버(`roles` 필수)가 아무것도 하지 않았고, 최근 작업 목록은 큐 목록과 레포 어댑터 목록을 둘 다 보여 같은 작업이 두 줄이었다

## 결정 (사용자, 2026-10-21)

1. **큐 하나 + 레인 2개** (#217): `SyncLane = 'github' | 'blog'`, `LANE_OF: Record<SyncJobType, SyncLane>`. 잡 모델·저장소·TTL·취소·진행 구독·활동 로그는 하나, `processLoop(lane)`이 레인마다 하나씩 돈다. GitHub를 쓰는 작업(workspace·continuous·cohort-repos·repo·member)은 같은 레포를 동시에 쓰지 않도록 한 줄, 블로그(RSS)는 자기 줄 — 전체 싱크가 돌아도 blog-check cron이 막히지 않는다
2. **블로그 싱크는 큐의 `blog` 작업**: `blog.admin.service`의 사설 저장소를 지우고 `executeWorkspaceBlogSync`만 남긴다(큐가 부른다). `POST /admin/blog/sync`는 대기·실행 중인 blog 작업이 있으면 그 작업을 돌려주고(30분 cron이 겹쳐도 하나), `GET /admin/blog/sync-jobs(/:id)`는 `blog.sync-jobs.ts`가 큐 작업을 **예전 응답 모양**(`status`·`message`·`source`·`progress`·`result`·`error`)으로 바꿔 준다. `blog-check.yml`은 수정 0. 큐에만 있는 `cancelled`는 폴링하는 쪽이 모르는 상태라 `failed`로 알린다
3. **멤버 PR 재수집도 큐의 `member` 작업**: `POST /admin/members/:id/resync-submissions`는 다른 직접 싱크와 같은 규칙 — `requestWaitMs`(240초) 안에 끝나면 200 + 결과, 아니면 202 + 작업. 같은 멤버가 이미 대기·실행 중이면 그 작업에 붙는다(`findActive(type, { githubId })`). `member.service`의 `resyncMemberPRs`와 `syncService` 의존은 사라졌다
4. **진행률 타입은 `sync.ports.ts` 하나**: `SyncProgress`(레포 한 개의 단계), `SyncJobProgress`(여러 레포), `BlogSyncSource`, `BlogSyncResult`. blog 기능은 `../sync/index.js`에서 타입만 가져온다(의존 방향 그대로: sync가 blog를 모른다)
5. **어드민 에러 응답은 `{ message }` 하나** (#215): 라우트의 `{ error }` 25곳을 `badRequest`/`HttpError(409)`/`NotFoundError`로. 미들웨어가 Prisma P2025를 404로(`isRecordNotFoundError`). person 링크 없는 대상 400 → 404. **공개 API 계약은 그대로** — 어드민 계약 스냅샷 9개와 외부 서비스 스냅샷 4개만 `error → message`로 갱신(PR에 diff 첨부)
6. 어드민 SPA (#216·#217): 기수 추가는 `{ cohort, roles: ['crew'] }`, 최근 작업은 큐 목록에서 `repo`·`blog` 종류를 빼고 어댑터 목록과 합친다. 재수집이 202면 "큐에서 실행 대기 중" 토스트

## 결과

- 운영 배포 뒤 API 지문(공개 17 + 어드민 GET) 동일(`FINGERPRINT_SAME`), `blog-check` workflow_dispatch 1회 성공(큐 blog 레인에서 `github-actions` 소스로 실행, 진행 메시지 그대로)
- 테스트 41 suites · 592 tests · 139 snapshots. 새로 고정한 것: 레인(blog가 github 실행 중에도 돈다, github끼리 순차, `findActive` 키), `requestMemberSync`(완료·같은 멤버 합류), 블로그 잡 라우트(폴링·중복 방지·404), 멤버 재수집 라우트(200/202/404), 어드민 SPA 202 토스트
- 계약 스냅샷 변경: 블로그 2건은 가짜 서비스로 못 고정해 실제 큐 테스트로 옮김, 재수집 1 → 3건(200/202/404), `createJob` 호출 인자 3건(위치 인자 → 옵션 객체, HTTP 응답은 동일)

## 하지 않은 것

- 큐를 DB에 영속하지 않는다(재시작하면 비는 in-memory 그대로). 30분·10분 cron이 다시 채운다
- 공개 API의 에러 모양은 손대지 않았다(웹이 `ApiError.body`로 읽는 계약)
