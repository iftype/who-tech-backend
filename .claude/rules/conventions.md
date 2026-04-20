# 코드 컨벤션

## 필수 규칙

- **ESM only** — `import/export` 사용, `require` / `module.exports` 금지
- **TypeScript strict** — `any` 타입 금지, `unknown` + 타입가드로 대체
- **에러 타입 명시** — `catch (e)` 후 `instanceof Error` 체크 필수
- **Prisma는 repository만** — service에서 직접 `db.*` 호출 금지
- **`console.log` 커밋 금지**

## 커밋 규칙

```
feat / fix / refactor / test / chore
subject 소문자, 한국어 가능
예: feat: 멤버 역할 필터링 추가
```

## PR 규칙

- `feat/#이슈번호-설명` 브랜치 → main PR
- 기능 완성 시에만 PR (중간 커밋 PR 금지)
