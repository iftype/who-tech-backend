import prisma from '../db/prisma.js';
import { runConsistencyChecks } from '../db/consistency.js';

// DB 일관성 검사 실행: node --env-file=.env dist/scripts/check-db-consistency.js (위반이 있으면 종료 코드 1)
async function main() {
  const results = await runConsistencyChecks(prisma);
  for (const { name, count } of results) console.log(`${count === 0 ? 'ok  ' : 'FAIL'} ${name} ${count}`);
  const failed = results.filter((r) => r.count > 0);
  console.log(failed.length === 0 ? '일관성 위반 없음' : `일관성 위반 ${failed.length}종`);
  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
