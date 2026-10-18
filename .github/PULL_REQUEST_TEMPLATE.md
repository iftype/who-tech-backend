## 관련 이슈

<!-- 연관된 이슈 번호를 적어주세요 -->

closes #

## 작업 내용

<!-- 어떤 변경을 했는지 설명해주세요 -->

## 변경 사항

- [ ]
- [ ]

## 배포 영향

<!-- main 머지 = 운영 배포 (CI 성공 → deploy.yml → 서버 deploy-run.sh, 실패 시 자동 롤백) -->

- [ ] 런타임 코드/의존성 변경 없음 (문서·CI·테스트만)
- [ ] DB 마이그레이션 포함 (`prisma/migrations`) — 운영 DB 복사본에서 적용 확인함
- [ ] 환경변수 추가/변경 있음 — 서버 `.env`와 pm2 env 반영 계획:

## 검증

- [ ] `npm run lint` / `npm run format:check` / `npx tsc --noEmit`
- [ ] `npm test` (unit + integration)
- [ ] `npm run build` (admin-spa 포함)
- [ ] 머지 후 `https://iftype.site/health`의 commit 확인

## 롤백

<!-- 기본: 이 PR revert. 마이그레이션이 있으면 DB 복구 방법(~/backups/who-tech/pre-deploy)을 적어주세요 -->

## 리뷰 포인트

<!-- 리뷰어가 집중해서 봐줬으면 하는 부분을 적어주세요 -->

## 스크린샷

<!-- UI 변경이 있다면 첨부해주세요 -->
