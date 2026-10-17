// 테스트 파일마다 템플릿 DB를 복사해 독립된 DB를 쓴다 (병렬 실행 시 파일끼리 데이터 간섭 방지).
import { copyFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

const dir = process.env['TEST_DB_DIR'];
const template = process.env['TEST_DB_TEMPLATE'];

if (!dir || !template) {
  throw new Error('테스트 DB가 준비되지 않았습니다. jest globalSetup을 확인하세요.');
}

const dbPath = join(dir, `${randomUUID()}.db`);
copyFileSync(template, dbPath);
process.env['DATABASE_URL'] = `file:${dbPath}`;
