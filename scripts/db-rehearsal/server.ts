// DB 변경 리허설용 서버. 운영 DB 복사본(DATABASE_URL)에 마이그레이션을 적용하고 백엔드를 띄운다.
// 외부 요청(GitHub·RSS)은 막아 복사본 데이터가 바뀌지 않게 한다. scripts/db-rehearsal/rehearse.sh가 실행한다
import { execFileSync } from 'node:child_process';

const PORT = Number(process.env['PORT'] ?? 3300);
execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env: process.env, stdio: 'inherit' });

globalThis.fetch = async (input) => {
  throw new Error(`[rehearsal] 외부 요청 차단: ${String(input instanceof Request ? input.url : input)}`);
};

const { default: app } = await import('../../src/app.js');
app.listen(PORT, '127.0.0.1', () => console.log(`[rehearsal] http://127.0.0.1:${PORT}`));
