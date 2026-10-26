# Changelog

## [1.5.0](https://github.com/iftype/who-tech-backend/compare/v1.4.0...v1.5.0) (2026-10-26)


### 기능

* 최근 PR 활동으로 미션 레포 자동 분류 — 미분류 추가, active는 활동 중 continuous ([#236](https://github.com/iftype/who-tech-backend/issues/236)) ([#237](https://github.com/iftype/who-tech-backend/issues/237)) ([312662f](https://github.com/iftype/who-tech-backend/commit/312662f7af572f306de1cdad887892a510764aae))
* 하네스 변경 검사 — 턴 종료 시 바뀐 파일 typecheck·eslint·관련 테스트 (Stop 훅) ([#241](https://github.com/iftype/who-tech-backend/issues/241)) ([bf79d51](https://github.com/iftype/who-tech-backend/commit/bf79d51a3cc809b78629a31574f6325dd878dd82))


### 버그 수정

* Deploy 확인이 트리거 커밋보다 새 커밋 배포도 성공으로 — 머지가 겹칠 때 오탐 ([#239](https://github.com/iftype/who-tech-backend/issues/239)) ([#240](https://github.com/iftype/who-tech-backend/issues/240)) ([cb304c7](https://github.com/iftype/who-tech-backend/commit/cb304c7c9cd2295d076993de38125e4f19e01135))
* **deps:** npm audit fix로 body-parser·fast-uri·qs 취약점을 해소한다 ([#252](https://github.com/iftype/who-tech-backend/issues/252)) ([2f2cd65](https://github.com/iftype/who-tech-backend/commit/2f2cd650370729674cc388a8a3f2add7c00f74e0))
* 공개 API의 track=all·모르는 트랙을 필터 없음으로 ([#230](https://github.com/iftype/who-tech-backend/issues/230)) ([#233](https://github.com/iftype/who-tech-backend/issues/233)) ([4f01bbb](https://github.com/iftype/who-tech-backend/commit/4f01bbbf6b43f222dce3c945d40f0d2d5a684c2d))
* 싱크 트리거를 서버 crontab으로 — GitHub Actions 크론이 3~4시간씩 밀림 ([#229](https://github.com/iftype/who-tech-backend/issues/229)) ([#235](https://github.com/iftype/who-tech-backend/issues/235)) ([02f2a35](https://github.com/iftype/who-tech-backend/commit/02f2a352412a68e54cd110b6e4b0ac928ba392e5))
* 작업 기록 복원 테스트의 시계를 고정 — 날짜가 지나면 깨지던 테스트 ([#231](https://github.com/iftype/who-tech-backend/issues/231)) ([#232](https://github.com/iftype/who-tech-backend/issues/232)) ([047365a](https://github.com/iftype/who-tech-backend/commit/047365ac8afeea9194548146aaba6f7887c56bb3))
* 프로필 새로고침 실패 응답 정리 — 어드민 502, 공개 429 error 필드 제거 ([#243](https://github.com/iftype/who-tech-backend/issues/243)) ([b7018a6](https://github.com/iftype/who-tech-backend/commit/b7018a68260beb5c632fcd10b7dace8ff6855166))


### 리팩토링

* **admin:** 대시보드형 정리 — 사이드바 내비, 로그 콘솔 접힘, 버튼 색 3종 ([#242](https://github.com/iftype/who-tech-backend/issues/242)) ([088b0f1](https://github.com/iftype/who-tech-backend/commit/088b0f17f4d5d40d4363cb81dd20ca635e61bd1a))
* **admin:** 멤버 행 218줄에서 작업 버튼·읽기 전용 셀을 분리 ([#248](https://github.com/iftype/who-tech-backend/issues/248)) ([e84244c](https://github.com/iftype/who-tech-backend/commit/e84244c39a66543c420d695d78860b72fa693975))
* **admin:** 브라우저 confirm() 9곳을 앱 안 확인 창으로 ([#244](https://github.com/iftype/who-tech-backend/issues/244)) ([7d37206](https://github.com/iftype/who-tech-backend/commit/7d372062d2b009881cab004a9f4ffe677b1b439a))
* **admin:** 설정 탭 210줄을 워크스페이스 폼·태그 목록 편집기로 ([#245](https://github.com/iftype/who-tech-backend/issues/245)) ([0b19b97](https://github.com/iftype/who-tech-backend/commit/0b19b97c680934d8fce6fe4e1be3c366e1acf643))
* **admin:** 전역 CSS를 [@layer](https://github.com/layer) base로 옮기고 안 쓰는 클래스 삭제 ([#246](https://github.com/iftype/who-tech-backend/issues/246)) ([26727d2](https://github.com/iftype/who-tech-backend/commit/26727d2b5341be614fdb7439bf9ccc6861044171))

## [1.4.0](https://github.com/iftype/who-tech-backend/compare/v1.3.0...v1.4.0) (2026-10-21)


### 기능

* **admin:** 탭 요청 실패를 ErrorState(다시 시도)로 ([#226](https://github.com/iftype/who-tech-backend/issues/226)) ([7da837f](https://github.com/iftype/who-tech-backend/commit/7da837f5fcd9b5098909c34897ca71df89b246ca))

## [1.3.0](https://github.com/iftype/who-tech-backend/compare/v1.2.4...v1.3.0) (2026-10-21)


### 기능

* 싱크 작업 기록을 DB에 남겨 재시작 뒤에도 보이게 (SyncJobRecord) ([#220](https://github.com/iftype/who-tech-backend/issues/220)) ([5b04d2f](https://github.com/iftype/who-tech-backend/commit/5b04d2f31ce9a9222e6207a9cbe2e7b436274236))


### 버그 수정

* **sync:** 활동 로그 쓰기 실패가 큐 루프 밖으로 새지 않게 ([#225](https://github.com/iftype/who-tech-backend/issues/225)) ([ff06adc](https://github.com/iftype/who-tech-backend/commit/ff06adc65329630a9fec612418d62342177b68d5))


### 리팩토링

* **admin:** 헤더·탭 고정과 가로 스크롤, 상태 카드 하나(StatCard), 탭 variant ([#221](https://github.com/iftype/who-tech-backend/issues/221)) ([a392953](https://github.com/iftype/who-tech-backend/commit/a39295316c34857befa312774c05ab6a28bbdeca))
* 공개 API 에러도 { message } 하나로 — 라우트는 던지고 미들웨어가 모양을 정한다 ([#219](https://github.com/iftype/who-tech-backend/issues/219)) ([cc1c492](https://github.com/iftype/who-tech-backend/commit/cc1c492703a62ab140b44327a0e83b04f4e5fe41))

## [1.2.4](https://github.com/iftype/who-tech-backend/compare/v1.2.3...v1.2.4) (2026-10-21)


### 버그 수정

* **admin:** 기수 추가가 실제로 저장되게, 최근 작업 목록의 중복 행 제거 ([#216](https://github.com/iftype/who-tech-backend/issues/216)) ([e9e4e94](https://github.com/iftype/who-tech-backend/commit/e9e4e94480bb5e8b3cee63952cdd8619b17316e4))
* **admin:** 토스트 마운트, 401 로그아웃 동기화, 에러 본문 한 번만 읽기, SSE 정리, 낙관적 삭제 키 ([#201](https://github.com/iftype/who-tech-backend/issues/201)) ([b9f96ac](https://github.com/iftype/who-tech-backend/commit/b9f96ac59c4b5c6dad9ffa2968d5787591a64361))
* GitHub 레이트리밋은 짧은 대기만 재시도하고, 증분 싱크는 10페이지까지 본다 ([#210](https://github.com/iftype/who-tech-backend/issues/210)) ([c3a279e](https://github.com/iftype/who-tech-backend/commit/c3a279e946a04e6a0d871305d72760284daf7eb9))
* 공개 프로필 새로고침에 전체 횟수 상한(10분 30회)을 둔다 ([#208](https://github.com/iftype/who-tech-backend/issues/208)) ([baabdaa](https://github.com/iftype/who-tech-backend/commit/baabdaaa2e1a0bf96e993e8e69980eb83613a00e))
* 글이 하나도 없는 RSS 피드면 최근 90일 글을 지우지 않는다 ([#209](https://github.com/iftype/who-tech-backend/issues/209)) ([b2b04de](https://github.com/iftype/who-tech-backend/commit/b2b04de5a65dbcee1a7bcd610fd4e0644b220531))
* 닉네임 통계를 모든 제출에서 다시 계산한다 (같은 PR을 다시 처리하면 횟수가 부풀던 문제) ([#211](https://github.com/iftype/who-tech-backend/issues/211)) ([0e2cdf9](https://github.com/iftype/who-tech-backend/commit/0e2cdf95e2d7293c89d067bcbbf5e8d29b552271))
* 레포 싱크 작업을 싱크 큐에서 조회한다 (어드민 폴링이 항상 404이던 문제) ([#203](https://github.com/iftype/who-tech-backend/issues/203)) ([6b48866](https://github.com/iftype/who-tech-backend/commit/6b48866686e1dbfb51fa61edb1ae184f49a0fd3f))
* 배포 인증 fail-closed, 셸 문자열 제거, SSRF 차단, 도메인 경계, 끝난 싱크 작업 정리 ([#200](https://github.com/iftype/who-tech-backend/issues/200)) ([de8fd8f](https://github.com/iftype/who-tech-backend/commit/de8fd8ffe8e4758348bbaf82caf8c7ecf1cf3234))
* 어드민 에러 응답을 {message} 하나로, 없는 대상은 404 ([#215](https://github.com/iftype/who-tech-backend/issues/215)) ([91bfdd1](https://github.com/iftype/who-tech-backend/commit/91bfdd17cf5dcfd03cbcbeb9fc2cf43d31c34ae4))
* 없는 멤버·제출은 500 대신 404, 제출 삭제는 id로 찾는다 ([#207](https://github.com/iftype/who-tech-backend/issues/207)) ([9169f5d](https://github.com/iftype/who-tech-backend/commit/9169f5d9c0e2e2c77257391c7729e7ef2568e5ef))
* 직접 싱크 요청도 작업 큐를 거치게 (cron 202 대비) ([#214](https://github.com/iftype/who-tech-backend/issues/214)) ([87d21ce](https://github.com/iftype/who-tech-backend/commit/87d21cee26b23a5aab1cf9d5b3e0a80e9cec343e))


### 리팩토링

* **admin:** 뮤테이션 실패 토스트를 MutationCache 한곳으로, 멤버 검색 디바운스 ([#204](https://github.com/iftype/who-tech-backend/issues/204)) ([285cd5d](https://github.com/iftype/who-tech-backend/commit/285cd5d681ab6d6bf6faa9ae276ba31c5dffdef9))
* 레포 싱크의 PR 처리 단위 (슬림 조회, 기수·역할 id 캐시, 트랜잭션) ([#205](https://github.com/iftype/who-tech-backend/issues/205)) ([3901ce0](https://github.com/iftype/who-tech-backend/commit/3901ce061b8c5f3685b6c74c4870dea70395ac0c))
* 싱크 큐 하나에 레인 2개(github·blog), 블로그·멤버 싱크도 큐로 ([#217](https://github.com/iftype/who-tech-backend/issues/217)) ([39e681a](https://github.com/iftype/who-tech-backend/commit/39e681a0024af3f73638f12b31bda98fbb9570c8))
* 에러 모델 정리 (CancelledError, Express 5 네이티브 async 핸들러) ([#206](https://github.com/iftype/who-tech-backend/issues/206)) ([04878ec](https://github.com/iftype/who-tech-backend/commit/04878eca77e2798b17709a705b88303e4492b011))

## [1.2.3](https://github.com/iftype/who-tech-backend/compare/v1.2.2...v1.2.3) (2026-10-19)


### 버그 수정

* **admin:** 구조 개선 중 찾은 어드민 버그 4건 ([#198](https://github.com/iftype/who-tech-backend/issues/198)) ([47ec21b](https://github.com/iftype/who-tech-backend/commit/47ec21bf8d6fc71889b618143e980c9d54f282c4))

## [1.2.2](https://github.com/iftype/who-tech-backend/compare/v1.2.1...v1.2.2) (2026-10-19)


### 버그 수정

* DB 무결성 — 상태값 허용 목록, JSON 컬럼 검증, 일관성 검사, 제출 인덱스 ([#186](https://github.com/iftype/who-tech-backend/issues/186)) ([69a9fc5](https://github.com/iftype/who-tech-backend/commit/69a9fc594506e08875d9efcb58a912a8fa5ede54))
* RSS의 정적 페이지(소개·방명록·태그 목록 등)는 블로그 글로 수집하지 않음 ([#182](https://github.com/iftype/who-tech-backend/issues/182)) ([22f8af8](https://github.com/iftype/who-tech-backend/commit/22f8af80ae29aeeed3cbaa3c4874dbea40653c3e))
* 블로그 동기화에서 90일 지난 글을 지우지 않고, RSS에 남은 오래된 글도 수집 ([#180](https://github.com/iftype/who-tech-backend/issues/180)) ([40edd94](https://github.com/iftype/who-tech-backend/commit/40edd94ddcabe5f0cfd4336edde171d53fe1e315))
* 이전 GitHub ID 쓰기 경로 단일화 + DB 변경 리허설 도구 (F-0, F-1 이전 단계) ([#185](https://github.com/iftype/who-tech-backend/issues/185)) ([a0ed7c7](https://github.com/iftype/who-tech-backend/commit/a0ed7c712166cbfcbb0c2238208f57933aa21c32))


### 리팩토링

* **admin:** API 함수와 쿼리 키 팩토리로 데이터 계층 정리 ([#191](https://github.com/iftype/who-tech-backend/issues/191)) ([6cd2cde](https://github.com/iftype/who-tech-backend/commit/6cd2cdee71e12e4080b5f8b13b0b503a4b573583))
* **admin:** 반복되던 표 줄·링크·체크박스·카드를 공용 부품으로 ([#194](https://github.com/iftype/who-tech-backend/issues/194)) ([fe5a020](https://github.com/iftype/who-tech-backend/commit/fe5a0201e14ec5469a9e9527086e1a1905c1d092))
* **admin:** 색상 토큰과 공용 UI 컴포넌트 (D-1b) ([#192](https://github.com/iftype/who-tech-backend/issues/192)) ([686da76](https://github.com/iftype/who-tech-backend/commit/686da76b78361600a2afba8cd6528f0ed8252541))
* **admin:** 큰 탭 분리와 의존 규칙 강제 (D-2, D-3) ([#193](https://github.com/iftype/who-tech-backend/issues/193)) ([78166a1](https://github.com/iftype/who-tech-backend/commit/78166a1fdaac80c7535bffa2ef956c9a383a3608))
* 백엔드 구조 — infra 분리, 포트로 순환 제거, 조립·검증 정리 ([#184](https://github.com/iftype/who-tech-backend/issues/184)) ([6eea27f](https://github.com/iftype/who-tech-backend/commit/6eea27f0119c823a02588c38ece22965f7e0f5fd))
* 이전 GitHub ID JSON 컬럼 쓰기 중단, 테이블 쓰기 경로 하나로 (F-1 축소 2단계) ([#188](https://github.com/iftype/who-tech-backend/issues/188)) ([d1eb149](https://github.com/iftype/who-tech-backend/commit/d1eb14995170980d4133a7518f3817bcb37abc17))
* 이전 GitHub ID를 테이블에서 읽기 (F-1 축소 1단계), 기수 참조 감시 ([#187](https://github.com/iftype/who-tech-backend/issues/187)) ([e3bc887](https://github.com/iftype/who-tech-backend/commit/e3bc8871653bc41dca2981aeabf038ad96456b82))

## [1.2.1](https://github.com/iftype/who-tech-backend/compare/v1.2.0...v1.2.1) (2026-10-18)


### 버그 수정

* 잘못된 JSON 본문에 500 대신 400 응답 ([#177](https://github.com/iftype/who-tech-backend/issues/177)) ([54cc244](https://github.com/iftype/who-tech-backend/commit/54cc24498c809df80f55c41edf0a1525e2581271))

## [1.2.0](https://github.com/iftype/who-tech-backend/compare/v1.1.0...v1.2.0) (2026-10-18)


### 기능

* 처리되지 않은 예외·promise 거부를 로그로 남김 ([#158](https://github.com/iftype/who-tech-backend/issues/158)) ([053cfb3](https://github.com/iftype/who-tech-backend/commit/053cfb3caba39f9d68d7a43ae9df5fdf78a1ad87))


### 버그 수정

* db 백업 시 sqlite 잠금 대기 시간 추가 ([#153](https://github.com/iftype/who-tech-backend/issues/153)) ([025fb25](https://github.com/iftype/who-tech-backend/commit/025fb25bcbfaf6bd2cb61d2596146b7895859eff))
* missionrepo.workspaceid 외래키를 마이그레이션에 반영 ([#156](https://github.com/iftype/who-tech-backend/issues/156)) ([084c9a1](https://github.com/iftype/who-tech-backend/commit/084c9a1b3b90f427757b630ab58bbc970e07611b))
* 배포 백업 정리 실패로 롤백되던 문제 수정 ([#155](https://github.com/iftype/who-tech-backend/issues/155)) ([ab1d3db](https://github.com/iftype/who-tech-backend/commit/ab1d3db4a851cb55bd31d55da2e9dfb7c456d0a5))


### 리팩토링

* admin MemberTable의 새로고침 쿨다운을 훅으로 분리 ([#174](https://github.com/iftype/who-tech-backend/issues/174)) ([16fd6aa](https://github.com/iftype/who-tech-backend/commit/16fd6aa64d8bba9aea724777b8cafda8f62eaa10))
* admin RepoTab을 옵션·셀·표 모듈로 분리 ([#171](https://github.com/iftype/who-tech-backend/issues/171)) ([0478f96](https://github.com/iftype/who-tech-backend/commit/0478f96c116fab0e48dbc9e776b93ad00eef2aed))
* admin SyncTab에서 포맷 함수·스케줄 상태·최근 작업 표 분리 ([#172](https://github.com/iftype/who-tech-backend/issues/172)) ([f815c27](https://github.com/iftype/who-tech-backend/commit/f815c277b4f232242549ba3f3259027fe5eef156))
* admin 싱크·아카이브 탭의 스트림 로그 중복 코드 통합 ([#173](https://github.com/iftype/who-tech-backend/issues/173)) ([4b1f565](https://github.com/iftype/who-tech-backend/commit/4b1f5658c0c126b0465885e7275b7e03be03ecd3))
* 지배 기수 재계산 중복 로직을 공용 모듈로 분리 ([#169](https://github.com/iftype/who-tech-backend/issues/169)) ([d48f468](https://github.com/iftype/who-tech-backend/commit/d48f468968c686319ff725b3dbc26dfc73f483cc))
* 트랙 요약·멤버 아카이브 구성을 공용 함수로 분리 ([#168](https://github.com/iftype/who-tech-backend/issues/168)) ([bcd9ab6](https://github.com/iftype/who-tech-backend/commit/bcd9ab6323f7b0dd2776f1d75aead73c16279e0c))

## [1.1.0](https://github.com/iftype/who-tech-backend/compare/v1.0.1...v1.1.0) (2026-10-18)


### 기능

* 배포 검증용 /health 엔드포인트 추가 ([#125](https://github.com/iftype/who-tech-backend/issues/125)) ([30654a7](https://github.com/iftype/who-tech-backend/commit/30654a71489414d23b651742bf8505b19085fb0b))


### 버그 수정

* npm audit fix로 호환 범위 내 취약 의존성 업데이트 ([#140](https://github.com/iftype/who-tech-backend/issues/140)) ([ea966d3](https://github.com/iftype/who-tech-backend/commit/ea966d3b14dc430a6123138deffb1046c40bb224))
