# TecoTalk Module (`src/features/tecotalk/`)

> 우아한테크코스 테코톡 유튜브 재생목록을 수집해 `TecoTalk` 테이블에 저장하고, **업로드 연도 → 기수 / 발표자 닉네임**으로 멤버와 매칭한다. 주 1회 cron으로 갱신하며 YouTube 조회수도 함께 저장한다.

## 파일 구조

| 파일                  | 책임                                                                             |
| --------------------- | -------------------------------------------------------------------------------- |
| `youtube.ts`          | YouTube Data API v3 클라이언트. playlistItems→videos 페이지네이션, 조회수 수집   |
| `tecotalk.parser.ts`  | 발표자 구역 추출(`extractSpeakerZone`) + 닉네임 포함 검사(`nicknameInZone`)      |
| `tecotalk.service.ts` | 수집+매칭 오케스트레이션. `detectCohort` + 닉네임 포함 매칭으로 발표자(M:N) 연결 |
| `tecotalk.route.ts`   | `POST /admin/tecotalk/sync`, `GET /admin/tecotalk`                               |

## 주요 함수

```typescript
createTecoTalkService({ tecoTalkRepo, memberRepo, workspaceService, fetchVideos? }): TecoTalkService
```

| 메서드              | 설명                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| `syncTecoTalks()`   | 재생목록 수집 → 영상별 닉네임 파싱 → 연도→기수 매핑 → 멤버 매칭 upsert |
| `listTecoTalks(f?)` | cohort / matchStatus 필터로 목록 조회                                  |

## 매칭 규칙 (핵심)

**정책: 제목에서 닉네임을 추출하지 않고, 우리가 보유한 닉네임을 제목에 매칭한다.**

1. 업로드 연도를 `detectCohort(uploadedAt, cohortRules)` 로 기수 변환 (sync 모듈 재사용)
2. `extractSpeakerZone(title)`: 제목의 첫 `의 `(소유격) 또는 콜론 앞부분 = 발표자 구역 (주제 영역 제외 → 오탐 차단)
3. 해당 기수 멤버 각각에 대해 `nicknameInZone(zone, nickname)`(경계 포함 검사)로 발표자 여부 판정
4. **공동 발표(M:N)**: `프리, 말론의 ...` 처럼 여러 멤버가 매칭되면 모두 `TecoTalkSpeaker` 로 연결
5. 결과: 발표자 ≥1명 → `matched`, (기수 불명+동일닉 충돌) → `ambiguous`, 0명 → `unmatched`
6. 발표자는 `setSpeakers(talkId, memberIds)` 로 통째 교체(멱등). 기수별 멤버는 `candidateCache` 로 재조회 방지

## 데이터 노출 (프론트)

- 멤버 프로필: `GET /members/:githubId` 응답에 `tecoTalks[]` 포함 (뱃지용, `findByMemberId`)
- 블로그 피드: `GET /members/feed` 항목에 `id`, `viewCount` 포함 (피드 눈 아이콘 + 클릭수)
- 블로그 클릭수: `GET /members/blog-posts/:id/visit` (viewCount +1 후 302 리다이렉트)

## 의존성

- `TecoTalkRepository`, `MemberRepository` — DB 접근
- `WorkspaceService.getSyncContext()` — workspaceId + cohortRules
- `detectCohort` (`../sync/github.service.js`) — 연도→기수 매핑 재사용
- 환경변수: `YOUTUBE_API_KEY`(필수), `TECOTALK_PLAYLIST_ID`(선택, 기본 우아한테크코스 재생목록)

## 운영

- **초기 1회(전체 백필)**: `POST /admin/tecotalk/sync?mode=full` — 재생목록 전체 수집
- **주간 증분(기본)**: `POST /admin/tecotalk/sync` — 최신 `INCREMENTAL_LIMIT`(50)개만. 재생목록 앞쪽=최신 업로드라는 전제(검증됨). 신규 매칭 + 최근 영상 조회수 갱신
- 주간 cron: `.github/workflows/tecotalk-sync.yml` (매주 일요일, 파라미터 없이 호출 → 증분)
- 쿼터: 전체 689개 ≈ 28 units / 증분 ≈ 2 units (일 한도 10,000)
- 영상 메타·조회수·발표자(M:N)를 매 sync마다 재계산하여 upsert (videoId unique)
