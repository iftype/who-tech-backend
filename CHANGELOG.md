# Changelog

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
