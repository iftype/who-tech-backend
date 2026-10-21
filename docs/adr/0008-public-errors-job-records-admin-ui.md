# 0008 공개 API 에러도 `{ message }`, 큐 작업은 기록만 영속화, 어드민 UI는 범위를 정해 손본다

- 상태: 적용 (2026-10-22, #219 · #220 · #221)

## 배경

ADR 0007이 "하지 않은 것"으로 남긴 두 가지와, 라운드 시작 때 미룬 어드민 UI.

- 공개 API(`member.public.route`)만 `{ error }`로 답했다. 어드민은 #215에서 `{ message }`로 통일됐고, 웹의 `requestJson`은 본문을 로그용으로만 읽는다(메시지는 상태 코드·경로로 만든다) — 바꿔도 웹 코드 변경이 0인데 계약 스냅샷 변경이 무서워 미뤘다
- 싱크 큐는 in-memory라 재시작하면 작업 목록이 비었다. 어드민의 "최근 작업"이 배포 직후엔 늘 빈 화면
- 어드민 SPA는 토큰·cva 원시(`Button·Badge·Panel·Table`)를 갖췄지만 멤버 탭과 싱크 탭이 상태 카드를 따로 그렸고, 탭 8개가 좁은 화면에서 줄을 바꿨다

## 결정 (사용자 위임, 2026-10-22 "내 허용 없어도 전부")

1. **공개 API도 던진다** (#219): `{ error }` 6곳 → `badRequest`/`NotFoundError`, 미들웨어가 `{ message }`. refresh의 try/catch를 지워 500은 `internal server error`(원인 문구는 로그에만). 429는 웹 카운트다운이 읽는 `remainingSeconds`·`message`만 남긴다. 바꾸기 전에 **소비처(웹 `http.ts`·`member.api.ts`)를 읽어** 영향 0을 확인했다. 계약 스냅샷 7건(`error → message`)은 `-u` 없이 지우고 다시 쓰게 했고 diff를 PR에 붙였다
2. **영속화는 실행이 아니라 기록** (#220): `SyncJobRecord` 테이블(추가만). 큐는 그대로 메모리에서 돌고 상태가 바뀔 때마다 upsert — fire-and-forget이라 기록 실패가 실행을 막지 않는다. 부팅 때 `restore()`: 끝을 못 적은 기록은 `'server restarted'`로 실패 처리, TTL(6h) 안 기록은 목록 앞에 되살린다(실행하지 않는다 — GitHub 싱크는 중간 상태가 남을 수 있고 10분·30분 cron이 다시 채운다). 저장소가 없으면(테스트) 메모리만이라 기존 테스트 변경 0
3. **어드민 UI는 일관성과 반응형만** (#221): 헤더+탭 `sticky`, 탭은 `tabVariants`(cva) + `overflow-x-auto` + `aria-current`, 상태 카드는 `StatCard`·`StatGrid` 하나(멤버 탭 3장·싱크 탭 5장·헤더 배지가 같은 `statBadgeVariants`). 주관적 리디자인은 하지 않았다 — 사용자가 없는 동안 되돌리기 어려운 결정을 내리지 않는다. 기준 이미지는 CI(`update_snapshots`)에서 만들어 바뀐 2장(`members`·`sync`)만 갱신

## 결과

- #219 배포 뒤 운영 지문: `/members/no-such-member` 404 본문만 코드로 달라졌다. 그 밖 4건(검색·피드·팀 블로그)은 기준이 3시간 전이라 blog-check 2회분의 데이터 변화 — 응답 모양·건수는 정상
- 테스트 41 → 43 suites, 592 → 599 tests, 계약 스냅샷 139 그대로(모양 불변). 어드민 vitest 141

## 하지 않은 것

- 진행률(progress)은 기록하지 않는다(초 단위로 바뀐다). 끝난 뒤 step·result만
- 큐를 DB 기반으로 다시 쓰지 않았다. "재시작하면 사라진다"는 문제는 기록으로 닫혔다
