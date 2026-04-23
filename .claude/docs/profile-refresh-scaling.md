# 프로필 업데이트 스케일링

> 900명 멤버의 GitHub 프로필 업데이트 병목 해결 설계 문서

---

## 1. 문제 정의

- **멤버 수**: ~900명
- **기존 처리량**: `limit=30`, `staleHours=24` → 30명/일 → **30일에 한 바퀴**
- **실제 병목**: RSS probe 순차 실행 (최대 15초/인)
- **GitHub API**: 5,000/hour 한도 → 여유로움 (900명 = 1,800회, 36%)
- **DB**: SQLite (Prisma) — 쓰기 serialized

---

## 2. 병목 분석

```
refreshWorkspaceProfiles
  ├→ memberRepo.findWithFilters()     ← 900명 전체 조회 (빠름)
  ├→ shouldRefreshProfile() 필터링    ← 30명 선정
  └→ for-loop: refreshMemberProfileById()  ← 순차 실행 (병목)
       ├→ nicknameStats 재계산        ← 로컬 처리 (빠름)
       ├→ GitHub API 호출            ← ~0.5초 (빠름)
       ├→ RSS probe (candidates 순회) ← 최대 15초 (병목)
       └→ memberRepo.update()         ← ~수 ms (빠름)
```

**핵심**: RSS probe가 끝날 때까지 CPU/DB가 idle. 외부 HTTP를 병렬로 기다리면 처리량이 선형 증가.

---

## 3. 해결책: Concurrency 제어 + Frequency 증가

### 3.1 코드 변경 (`member.service.ts`)

- **`p-queue` 도입**: GitHub API 호출이 필요한 멤버만 병렬 큐에 넣음
- **`concurrency=5`**: SQLite file-based DB 최적값 (8 이하 권장)
- **DB write**: 각 `refreshMemberProfileById` 낸부에서 직렬로 처리 (SQLite 제약 존중)

```typescript
const githubQueue = new PQueue({ concurrency: input?.concurrency ?? 5 });

// GitHub API 필요 멤버 → 병렬 큐
const githubTasks = githubMembers.map((m) => githubQueue.add(() => processMember(m)));

// 나머지 멤버 → 순차 처리 (빠름)
for (const m of otherMembers) {
  await processMember(m);
}
```

### 3.2 예상 처리 시간

| 시나리오                           | 처리 시간                                 |
| ---------------------------------- | ----------------------------------------- |
| 기존 (순차, limit=30)              | 30일에 한 바퀴                            |
| 병렬화 (concurrency=5, limit=100)  | **~10분** (900명 기준)                    |
| GitHub Actions (매시간, limit=100) | 12시간 stale 기준 → **9시간에 전체 순회** |

### 3.3 Workflow 변경 (`member-refresh.yml`)

```yaml
schedule:
  - cron: '0 * * * *' # 매시간
# query: staleHours=12&limit=100
```

- `staleHours=12`: 12시간 지난 멤버만 대상
- `limit=100`: 1회에 최대 100명 처리
- 900명 전체가 stale하면 9시간에 한 바퀴

---

## 4. 기수별 분산에 대한 분석

사용자가 "기수별로?"라고 질문했으나, **기수별 분산은 병목 해결에 도움이 되지 않음**.

| 관점        | 평가                                               |
| ----------- | -------------------------------------------------- |
| 기술적 병목 | RSS probe 순차 실행 → 기수별로 나눠도 여전히 순차  |
| SQLite 제약 | 기수별 동시 실행 → lock 경합 오히려 느려짐         |
| 인원 불균형 | 최신 기수 400명 vs 옛 기수 50명 → 처리량 불균형    |
| 유용한 경우 | **최신 기수 우선순위** 같은 비즈니스 로직에는 적합 |

**결론**: 기수별 분산은 스케줄링 편의(우선순위)는 주지만, **처리량 증가는 Concurrency 제어(C)가 유일한 해결책**.

현재 `memberRepo.listStaleProfiles`가 이미 `cohort` 필터를 지원하므로, 기수별 우선순위가 필요하면 API 파라미터로 `cohort`를 지정하면 됨.

---

## 5. 구현 상세

### 파일 변경 목록

| 파일                                    | 변경 내용                                                      |
| --------------------------------------- | -------------------------------------------------------------- |
| `src/features/member/member.service.ts` | `p-queue` import, `refreshWorkspaceProfiles` 병렬화            |
| `.github/workflows/member-refresh.yml`  | cron `0 0 * * *` → `0 * * * *`, limit 30→100, staleHours 24→12 |
| `package.json`                          | `p-queue` 추가                                                 |

### API 파라미터

```
POST /admin/members/refresh-profiles
  ?limit=100          (default: 30)
  &staleHours=12      (default: 24)
  &concurrency=5      (default: 5)
  &cohort=7           (optional, 기수 필터)
  &force=true         (optional, stale 무시)
```

---

## 6. 주의사항

- **동시성 과다**: 20 이상으로 올리면 RSS timeout 대기 중 메모리/소켓 부족. 5~10에서 시작.
- **GitHub API**: `@octokit/plugin-throttling`이 5,000/hour을 자동 관리. 별도 rate limiter 불필요.
- **SQLite WAL**: Prisma + SQLite 기본값은 WAL mode. 아닐 경우 읽기도 block될 수 있음.
- **에러 로그**: 병렬화하면 실패 로그가 한꺼번에 쏟아짐. `failures` 배열에 상한(10개) 유지.

---

## 7. Escalation Trigger

다음 상황에서는 추가 아키텍처 변경이 필요함:

| 트리거                                     | 해결책                                |
| ------------------------------------------ | ------------------------------------- |
| 멤버 5,000명+ → GitHub API 5,000/hour 소모 | GitHub App 전환 또는 토큰 로테이션    |
| 다중 서버 확장                             | 외부 job queue (Redis/Bull) 도입      |
| RSS probe timeout 빈번                     | RSS probe와 프로필 업데이트 완전 분리 |

---

## 8. 참고 자료

- [GitHub API Best Practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
- [p-queue](https://github.com/sindresorhus/p-queue)
- AGENTS.md: `/test`, `/typecheck`, `/migrate` 커맨드 규칙
