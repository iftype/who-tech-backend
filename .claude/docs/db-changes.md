# DB 구조 변경 절차 (확장 → 이전 → 축소)

운영 중인 기능을 멈추지 않고 스키마를 바꾸기 위한 규칙 (ARCHITECTURE_PLAN Phase F).

## 원칙

1. **확장**: 새 컬럼·테이블을 추가만 한다 (삭제·이름 변경 금지)
2. **이전**: 쓰기 경로를 한 곳으로 모아 옛 구조와 새 구조를 함께 쓰고, 백필로 기존 데이터를 맞춘 뒤 일관성 검사가 0인지 확인한다. 읽기를 새 구조로 옮긴다
3. **축소**: 다음 배포에서 옛 구조를 쓰는 코드를 지우고, 그다음 배포의 마이그레이션에서 컬럼을 삭제한다 (🔒 삭제는 사용자 승인)

- 단계마다 별도 배포. 어느 단계에서 되돌려도 직전 코드가 그대로 동작해야 한다
- 배포 전 자동 백업(`deploy-run.sh`)에 더해, 데이터를 고치는 작업(백필 등) 직전에는 수동 백업을 남긴다

## 리허설 (운영 DB 복사본)

```bash
scripts/db-rehearsal/fetch-backup.sh /tmp/prod.db                     # 운영 DB 복사본 (운영에는 쓰지 않음)
git switch main && scripts/db-rehearsal/rehearse.sh /tmp/prod.db /tmp/before
git switch <브랜치> && scripts/db-rehearsal/rehearse.sh /tmp/prod.db /tmp/after "<백필 명령>"
diff /tmp/before/fingerprint.txt /tmp/after/fingerprint.txt            # 공개·어드민 API 응답 지문 비교
cat /tmp/after/checks.txt                                              # 일관성 검사 (모두 0이어야 함)
```

- `rehearse.sh`는 복사본에 마이그레이션을 적용하고(외부 요청 차단) 백엔드를 띄워 `scripts/api-fingerprint.mjs`로 응답 지문을, `src/db/consistency.ts`로 일관성 검사를 남긴다
- 지문 차이는 의도한 것만 있어야 한다 (PR 설명에 근거와 함께 적는다)

## 운영 반영

```bash
ssh oracle
cd ~/app/who-tech-backend
sqlite3 prisma/prisma/dev.db ".timeout 30000" ".backup /home/ubuntu/backups/who-tech/dev-$(date +%Y%m%d-%H%M%S)-pre-<작업>.db"
node --env-file=.env dist/scripts/<백필>.js
node --env-file=.env dist/scripts/check-db-consistency.js   # 일관성 검사 (위반 시 종료 코드 1)
```

## 진행 기록

| 대상                                                                         | 확장        | 이전                         | 축소(코드) | 축소(컬럼 삭제) |
| ---------------------------------------------------------------------------- | ----------- | ---------------------------- | ---------- | --------------- |
| 이전 GitHub ID: `Member.previousGithubIds`(JSON) → `PreviousGithubId` 테이블 | 테이블 있음 | 저장소 단일 쓰기 경로 + 백필 |            | 🔒              |
