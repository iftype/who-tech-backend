// 어드민 스크린샷 테스트용 서버 (ARCHITECTURE_PLAN A-2). playwright.admin.config.ts의 webServer가 실행한다.
// 임시 DB에 마이그레이션 + 계약 테스트와 같은 고정 시드를 넣고, 시각을 고정하고, 외부 요청을 막은 뒤
// 빌드된 어드민 화면(dist/public/admin-dist)과 백엔드 앱을 함께 띄운다. 운영·개발 DB는 건드리지 않는다
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import express from 'express';

const PORT = Number(process.env['ADMIN_VISUAL_PORT'] ?? 3200);
export const ADMIN_VISUAL_SECRET = 'visual-secret';

const dbPath = join(mkdtempSync(join(tmpdir(), 'who-tech-admin-visual-')), 'visual.db');
process.env['DATABASE_URL'] = `file:${dbPath}`;
process.env['ADMIN_SECRET'] = ADMIN_VISUAL_SECRET;
execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env: process.env, stdio: 'ignore' });

const { SEED_NOW, seedContractData } = await import('../../src/__tests__/fixtures/contract-seed.js');

// 서버 시각 고정 (상대 시간·"최근 N분" 계산이 매번 같도록)
const FIXED = SEED_NOW.getTime();
const RealDate = Date;
class FrozenDate extends RealDate {
  constructor(...args: ConstructorParameters<typeof Date> | []) {
    if (args.length === 0) super(FIXED);
    else super(...(args as ConstructorParameters<typeof Date>));
  }

  static override now() {
    return FIXED;
  }
}
globalThis.Date = FrozenDate as DateConstructor;

// GitHub·YouTube·RSS 등 외부 요청 차단
globalThis.fetch = async (input) => {
  throw new Error(`[admin-visual] 외부 요청 차단: ${String(input instanceof Request ? input.url : input)}`);
};

const { default: prisma } = await import('../../src/db/prisma.js');
await seedContractData(prisma);
const { default: app } = await import('../../src/app.js');

const server = express();
server.use('/admin/ui/admin-dist', express.static(resolve('dist/public/admin-dist')));
server.use(app);
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[admin-visual] http://127.0.0.1:${PORT}/admin/ui/admin-dist/ (db: ${dbPath})`);
});
