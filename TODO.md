=== 마지막 세션: 2026-04-21 ===

### 완료 작업

✅ 개인 프로필 새로고침 fetchUserBlogCandidates + RSS 프로빙으로 변경 (blog 필드만 → bio/README/소셜 스캔)
✅ 개인 새로고침 GitHub API 실패 시 500 반환 (기존: 200 + profileRefreshError)
✅ .omc 디렉토리 git 추적 제거
✅ 어드민 SPA Phase 0 스캐폴드 (src/public/admin-spa/)
✅ GitHub 토큰 Classic PAT으로 교체 + pm2 env 반영

=== 다음 세션 작업 ===

## 1️⃣ 어드민 React SPA (최우선)

**플랜**: `.omc/plans/admin-react-spa.md`

- [x] Phase 0: Vite + React + Tailwind 스캐폴드
  - 빌드 출력: `dist/public/admin-dist/`
  - `npm run build:admin` / `npm run dev:admin` 스크립트 추가
- [ ] Phase 1: App Shell (Auth, Layout, 5탭 네비게이션)
  - HashRouter (`/#/members`, `/#/sync`, `/#/repos`, `/#/blog`, `/#/settings`)
  - AuthContext (localStorage Bearer token)
  - StatCards
- [ ] Phase 2: 멤버 탭
- [ ] Phase 3: 싱크 탭 (SSE 스트리밍)
- [ ] Phase 4: 레포 탭
- [ ] Phase 5: 블로그 + 설정 탭
- [ ] Phase 6: 마이그레이션 (old vanilla JS 삭제)

**주의**: CI에 `cd src/public/admin-spa && npm install` 단계 추가 필요 (`.github/workflows/deploy.yml`)

## 2️⃣ 전체 서버 코드 리팩토링

- 하네스 문서(.claude/rules/, .claude/docs/) 업데이트 포함
- 테스트 훅으로 기능 보호 후 리팩토링 진행 (기능 변경 없음)
- 주요 대상: src/features/{sync,blog,member}/

## 3️⃣ Dependabot 취약점 패치

- 현재 2개 high severity (GitHub Security tab 참고)

---

## 서버 운영 메모

- GitHub Token: Classic PAT (`public_repo` + `read:user`), `.env`에 저장
- pm2 env 업데이트: `set -a && . .env && set +a && pm2 restart backend --update-env`
- blog 수집 24h 게이트: sync에서 profileFetchedAt 기준, 즉시 반영은 개인 새로고침 사용
- admin-spa 로컬 개발: `cd src/public/admin-spa && npm install && npm run dev` (포트 5173, /admin 프록시→3000)
