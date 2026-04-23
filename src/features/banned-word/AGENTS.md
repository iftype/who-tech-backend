# Banned-Word Module (`src/features/banned-word/`)

> 닉네임 추출 시 제외할 금지어 관리. 한글 토큰 빈도 집계에서 해당 단어를 필터링.

## 파일 구조

| 파일                   | 라인 | 책임                   |
| ---------------------- | ---- | ---------------------- |
| `banned-word.route.ts` | 54   | 금지어 CRUD 엔드포인트 |

## 주요 함수

```typescript
createBannedWordRouter({ bannedWordRepo, workspaceService }): Router
```

라우터가 직접 repository를 주입받아 service 레이어 없이 동작.

| 엔드포인트                       | 설명                       |
| -------------------------------- | -------------------------- |
| GET `/admin/banned-words`        | 금지어 목록                |
| POST `/admin/banned-words`       | { word } 생성. 중복 시 409 |
| DELETE `/admin/banned-words/:id` | 삭제                       |

## 의존성

- `BannedWordRepository` — DB 접근 (findAll, create, delete)
- `WorkspaceService` — workspace id 조회

## 사용 위치

- `src/shared/nickname.ts`의 `extractNicknameCandidates`에서 `bannedWords` 목록을 받아 필터링에 사용.
