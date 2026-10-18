# DB 백업과 복구

운영 DB는 서버의 SQLite 파일 하나다: `.env`의 `DATABASE_URL` (`file:/home/ubuntu/app/who-tech-backend/prisma/prisma/dev.db`).
`prisma/dev.db`(0바이트)는 운영 DB가 아니다.

## 백업 종류

| 종류      | 위치 (`~/backups/who-tech/`)              | 시점                                          | 보관      |
| --------- | ----------------------------------------- | --------------------------------------------- | --------- |
| 일일      | `daily/dev-YYYYMMDD-HHMMSS.db.gz`         | 매일 03:17 (crontab → `scripts/backup-db.sh`) | 14일      |
| 배포 직전 | `pre-deploy/dev-YYYYMMDD-HHMMSS-<sha>.db` | 마이그레이션 직전 (`scripts/deploy-run.sh`)   | 최근 10개 |
| 수동      | 루트에 이름 붙여 저장                     | 위험한 작업 전                                | 수동 정리 |

모든 백업은 `sqlite3 .backup`(서비스 중에도 일관된 스냅샷)으로 만든다. `cp`로 복사하지 않는다.
일일 백업 로그: `~/backups/who-tech/backup.log`

> 백업이 서버와 같은 디스크에 있다. 디스크/인스턴스 장애에는 대비되지 않으므로, 외부 저장소로의 복제는 별도 과제다.

## 설치 (서버, 1회)

```bash
crontab -l 2>/dev/null | { cat; echo '17 3 * * * /home/ubuntu/app/who-tech-backend/scripts/backup-db.sh >> /home/ubuntu/backups/who-tech/backup.log 2>&1'; } | crontab -
```

## 복구 절차

1. 복구할 백업을 고르고 무결성을 확인한다.
   ```bash
   B=~/backups/who-tech/daily/dev-YYYYMMDD-HHMMSS.db.gz
   gunzip -c "$B" > /tmp/restore.db && sqlite3 /tmp/restore.db 'PRAGMA integrity_check;'   # ok 여야 함
   ```
2. 서비스를 멈추고 현재 DB를 따로 보관한다 (되돌릴 수 있게).
   ```bash
   cd ~/app/who-tech-backend
   DB="$(grep ^DATABASE_URL= .env | cut -d= -f2- | tr -d '"')"; DB="${DB#file:}"
   pm2 stop backend
   sqlite3 "$DB" ".backup '$HOME/backups/who-tech/pre-restore-$(date +%Y%m%d-%H%M%S).db'"
   ```
3. 백업으로 교체하고 마이그레이션 상태를 맞춘 뒤 재시작한다.
   ```bash
   cp /tmp/restore.db "$DB"
   npx prisma migrate deploy   # 백업 시점 이후 추가된 마이그레이션 적용
   pm2 start backend
   curl -s localhost:3000/health
   ```

## 복구 리허설 기록

- 2026-10-18: 일일 백업 → 별도 파일로 복원 → 포트 3993에서 앱 기동 → 테이블 건수·공개 API 응답을 운영과 비교 (IMPROVEMENT_PLAN 4-1)
