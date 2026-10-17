// 테스트 전용 템플릿 DB를 임시 폴더에 만들고 마이그레이션을 적용한다.
// 실제 dev.db / 운영 DB를 절대 건드리지 않도록 DATABASE_URL을 여기서 강제한다.
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default function globalSetup() {
  const dir = mkdtempSync(join(tmpdir(), 'who-tech-test-'));
  const templatePath = join(dir, 'template.db');

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: `file:${templatePath}` },
    stdio: 'ignore',
  });

  process.env['TEST_DB_DIR'] = dir;
  process.env['TEST_DB_TEMPLATE'] = templatePath;
}
