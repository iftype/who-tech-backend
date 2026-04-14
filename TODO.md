=== 마지막 세션: 2026-04-11 23:50 ===

### 완료 작업

✅ 서버 배포 문제 해결 (원인: npm install 미실행 + PM2 좀비 프로세스)
✅ /admin/deploy 엔드포인트 보안 강화 (ADMIN_SECRET 인증 추가)
✅ 배포 스크립트 개선 (npm install, pm2 restart 명시)
✅ 에러 슈팅 기록: `.claude/deployment-troubleshooting-2026-04-11.md`

=== 다음 세션 작업 ===

## 1️⃣ GitHub Secrets 설정 확인

- ✅ ADMIN_SECRET만 필요 (SSH 관련 불필요)
- 참고: frontend/TODO.md와 동기화

## 2️⃣ 배포 흐름 검증

```bash
# 테스트 배포
curl -X POST https://iftype.store/admin/deploy \
  -H "Authorization: Bearer $ADMIN_SECRET"

# 로그 확인
ssh oracle 'pm2 logs backend --lines 50'
```

## 3️⃣ Dependabot 취약점 패치

- 현재 2개 high severity 존재
- 참고: GitHub Security tab

---

## 📋 대규모 리팩토링 예정 (다음주)

### 범위

- 서비스 레이어 정규화 (sync.service, blog.service)
- 레포지토리 패턴 통일
- 타입 안정성 강화

### 필요 에이전트

- `/oh-my-claudecode:architect` - 아키텍처 설계
- `/oh-my-claudecode:code-reviewer` - 리팩토링 검토
- `/oh-my-claudecode:executor` - 대규모 작업 실행

### 예상 영향

- 주요 파일: src/features/{sync,blog,cohort-repo}/\*\*
- 테스트: 기존 100+ 테스트 유지 필수
- 배포: 리팩토링 완료 후 한 번에 배포

### 준비 사항

- 현재 src/ 구조 스냅샷 저장
- 테스트 커버리지 확인
- develop 브랜치에서 진행
