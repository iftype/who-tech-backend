# 0006 보안 수정과 에러 모델

- 상태: 적용 (2026-10-20, #200 · #206 · #207 · #208)

## 배경

- `/admin/deploy`가 `token !== process.env.ADMIN_SECRET`로 비교해, 시크릿이 비어 있고 헤더도 없으면 `undefined !== undefined`가 거짓 → 통과(fail-open). 배포 로그는 `/tmp` 파일 이름을 셸 문자열에 넣어 읽었다
- 블로그 주소는 크루가 GitHub 프로필에 적은 값(외부 입력)인데, 서버가 그 주소로 RSS를 요청하면서 사설 IP·클라우드 메타데이터 주소를 막지 않았다(SSRF). 무시 도메인은 `endsWith`라 `x.com`이 `netflix.com`까지 걸렀다
- 공개 새로고침은 아이디별 1분 제한뿐이라 아이디를 바꿔 가며 부르면 GitHub 토큰이 바닥났다
- 에러를 문자열로 구분했다(`err.message === 'cancelled'`, `message === 'Member not found'`). 없는 멤버는 일반 `Error`라 어드민에서 500으로 나갔다
- Express 5인데 모든 라우트가 `asyncHandler`로 감싸져 있었다

## 결정

1. **비밀키 비교는 fail-closed**: `isAdminToken` — 빈 시크릿 거부 + `timingSafeEqual`. 배포 라우트는 실패한 시도만 세는 횟수 제한(15분 10회). 배포 로그는 `fs`로 읽는다
2. **바깥 주소는 공개 호스트만**: `isPublicHostname`(루프백·사설·링크로컬·CGNAT·멀티캐스트·단일 라벨·숫자 IP 표기 거부), `fetchPublic`이 리다이렉트를 직접 따라가며 hop마다 다시 검사. 도메인은 점 경계로 비교
3. **공개 새로고침은 전체 상한**(10분 30회). 웹 요청은 모두 Vercel 프록시 IP로 들어와 IP별로는 셀 수 없다(nginx 로그로 확인)
4. **에러는 타입으로**: `CancelledError`(메시지 `'cancelled'` 그대로), `NotFoundError extends HttpError(404)`. 미들웨어가 상태 코드를 정한다
5. **Express 5 네이티브 async**: `asyncHandler` 제거

## 결과

- 운영에서 배포 엔드포인트 토큰 없음·틀림 401, 횟수 제한 헤더 확인
- API 계약 스냅샷 107개 동일, 운영 지문 동일 (404 전환은 계약 시드에 없는 멤버 요청이 없어 스냅샷 변화 없음)
- CodeQL `js/missing-rate-limiting` 경고는 미들웨어를 라우트 파일에서 직접 만들어야 인식했다(주입한 미들웨어는 못 따라감)
