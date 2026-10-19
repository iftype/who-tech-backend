# 0001 기능 사이 순환은 포트로 끊는다

- 상태: 적용 (2026-10-19, #184)

## 배경

싱크 작업 큐(`features/sync`)는 레포 PR 수집(`repo`)과 블로그 RSS 수집(`blog`)을 순서대로 실행한다. 그런데 `repo`·`blog`도 싱크 모듈의 함수(GitHub 조회, 프로필 갱신)를 가져다 써서 `repo ↔ sync`, `blog ↔ sync` 순환이 있었다. 순환이 있으면 한쪽을 고칠 때 다른 쪽 테스트까지 깨지고, 모듈을 떼어 테스트하기 어렵다.

## 결정

1. 여러 기능이 쓰는 외부 연동(GitHub 클라이언트, RSS)은 `infra/`로 내린다. 기능끼리 서로를 부를 이유가 줄어든다
2. 그래도 남는 "큐가 레포·블로그 수집을 실행" 방향은 큐 쪽에 필요한 동작만 인터페이스로 선언한다
   - `features/sync/sync.ports.ts`의 `RepoSyncRunner`, `WorkspaceBlogSyncRunner`
3. 구현은 `container.ts`(조립 코드)가 꽂는다. `sync`는 `repo`·`blog`를 import하지 않는다
4. 다른 기능은 `features/<기능>/index.ts`(공개 진입점)로만 쓴다. `scripts/check-feature-cycles.mjs --strict`와 dependency-cruiser가 CI에서 순환·내부 참조를 막는다

## 결과

- 기능 간 순환 2 → 0. 큐는 가짜 러너를 넣어 단위 테스트한다
- 조립이 `app.ts`(239줄)에서 `container.ts`로 옮겨가 `app.ts`는 HTTP 설정만 남았다(154줄)

## 버린 대안

- **이벤트 버스**: 순환은 사라지지만 호출 흐름이 코드에서 안 보인다. 한 서버·한 프로세스에서 순서대로 실행하는 큐에는 과하다
- **sync가 repo·blog를 직접 부르고 반대 방향만 제거**: repo·blog가 쓰던 GitHub·RSS 코드가 sync 안에 있어서, 먼저 `infra`로 내리지 않으면 반대 방향을 없앨 수 없었다
