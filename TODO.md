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
- [x] Phase 1: App Shell (Auth, Layout, 5탭 네비게이션)
- [x] Phase 2: 멤버 탭 (MemberTable, MemberFilters, MemberAddForm, Toast, Modal)
- [x] Phase 3: 싱크 탭 (SSE 스트리밍, 전체/기수/연속/레포 싱크)
- [x] Phase 4: 레포 탭 (목록/상태토글/싱크/삭제/탐색)
- [x] Phase 5: 블로그 탭 (RSS싱크/백필/최근글) + 설정 탭 (워크스페이스/금지어/무시도메인)
- [x] Phase 6: 마이그레이션 (admin.html/admin.css/scipts/ 삭제, /admin → /admin/ui/admin-dist/ 리다이렉트, deploy 명령 admin-spa npm install 추가)

**주의**: CI에 `cd src/public/admin-spa && npm install` 단계 추가 필요 (`.github/workflows/deploy.yml`)

## 2️⃣ 전체 서버 코드 리팩토링

- [x] blog.service.ts (309→107): blog.rss.ts 분리
- [x] member.service.ts (365→218): member.response.ts, member.profile-refresh.ts 분리
- [x] sync.service.ts (436→394): sync.pr-parser.ts 분리
- [ ] sync.service.ts (394줄) 추가 분리 여지 있음 (resolveProfile, upsertMemberAndSubmission)
- [ ] blog.admin.service.ts (279줄), repo.service.ts (256줄) 분리 검토
- [ ] 하네스 문서(.claude/rules/, .claude/docs/) 업데이트

## 3️⃣ Dependabot 취약점 패치

- 현재 2개 high severity (GitHub Security tab 참고)

---

## 서버 운영 메모

- GitHub Token: Classic PAT (`public_repo` + `read:user`), `.env`에 저장
- pm2 env 업데이트: `set -a && . .env && set +a && pm2 restart backend --update-env`
- blog 수집 24h 게이트: sync에서 profileFetchedAt 기준, 즉시 반영은 개인 새로고침 사용
- admin-spa 로컬 개발: `cd src/public/admin-spa && npm install && npm run dev` (포트 5173, /admin 프록시→3000)
