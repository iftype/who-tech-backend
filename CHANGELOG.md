# Changelog

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
