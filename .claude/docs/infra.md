# infra — 서버·배포·CI

---

## 2026-04-07

자동 배포 deploy.yml이 Node 버전/빌드 단계 정상화 상태 유지.

---

## 2026-04-03

**자동 배포 복구**

- **왜**: `SERVER_HOST` 시크릿이 구 IP로 되어 있어 ssh-keyscan 단계에서 Actions 실패
- **핵심 파일**: `.github/workflows/deploy.yml`
- **결정**: Oracle Cloud 서버 IP `152.69.232.170`으로 시크릿 갱신, 즉시 수동 배포(SSH) 병행
- **주의**: 서버 IP 변경 시 `SERVER_HOST` 시크릿 동기화 필수

---

## 2026-03-29

**deploy.yml에 빌드 단계 추가**

- **왜**: `migrate deploy` 뒤 `npm run build` 누락으로 배포 후 구버전 JS 실행
- **핵심 파일**: `.github/workflows/deploy.yml`
- **결정**: migrate → build → pm2 restart 순서로 고정

---

## 2026-03-27

**GitHub Actions 자동 배포 도입**

- **왜**: 수동 rsync 배포 → develop 푸시 시 자동화로 전환
- **핵심 파일**: `.github/workflows/deploy.yml`
- **결정**: SSH 키 base64 인코딩 → Secret `SSH_PRIVATE_KEY_B64`, git pull → npm install → prisma migrate → pm2 restart
- **주의**: Secrets 필요: `SERVER_HOST`, `SERVER_USER`, `SSH_PRIVATE_KEY_B64`

**블로그 RSS Tistory 406 수정**

- **왜**: rss-parser 기본 요청에 Tistory가 406 반환
- **핵심 파일**: `src/features/blog/blog.service.ts`
- **결정**: User-Agent, Accept 헤더 추가

---

## 2026-03-26

**Oracle Cloud AMD 서버 초기 세팅**

- 도메인 `iftype.store`, SSH `ssh oracle`
- Node.js 20, PM2 (tsx), Nginx, Certbot HTTPS 자동갱신
- fail2ban, Rate limiting 30req/min, 보안 헤더
- 배포 방식(초기): rsync + `npm install --ignore-scripts` + `pm2 restart backend`

**GitHub 조직·레포 초기 세팅**

- 조직 `who-tech-course` (public), 레포 3개: `frontend`, `backend`, `.github`
- `main` 브랜치 보호(PR + 리뷰 1명), `develop` 브랜치 생성

**테스트·린트 도구 세팅**

- ESLint flat config + Prettier, husky + commitlint, lint-staged
- Backend Jest + @swc/jest (ESM), `test:unit` CI / `test:integration` 로컬

**CI `test.yml`**

- PR 시 unit 테스트 자동 실행
- `npx prisma generate` + `DATABASE_URL=file:./prisma/dev.db` 환경변수 추가 (2026-03-27 수정)
