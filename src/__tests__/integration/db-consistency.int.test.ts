import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../db/prisma.js';
import { runConsistencyChecks } from '../../db/consistency.js';
import { seedContractData } from '../fixtures/contract-seed.js';

// 일관성 검사 쿼리가 실제 스키마에서 동작하고, 정상 데이터에서 0이며, 위반을 잡아내는지 (ARCHITECTURE_PLAN F-3·F-4)
beforeAll(async () => {
  await seedContractData(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('DB consistency checks', () => {
  it('should report no violations on consistent data', async () => {
    const failed = (await runConsistencyChecks(prisma)).filter((r) => r.count > 0);
    expect(failed).toEqual([]);
  });

  it('should catch an out-of-range status, a broken JSON column, and a previous-id mismatch', async () => {
    const member = await prisma.member.findFirstOrThrow({ where: { githubId: 'be-crew' } });
    await prisma.member.update({
      where: { id: member.id },
      data: { rssStatus: 'broken', nicknameStats: '{"a":1}', previousGithubIds: '["only-in-json"]' },
    });

    const failed = Object.fromEntries(
      (await runConsistencyChecks(prisma)).filter((r) => r.count > 0).map((r) => [r.name, r.count]),
    );
    expect(failed).toEqual({
      invalid_member_rssStatus: 1,
      invalid_json_nicknameStats: 1,
      previous_id_missing_in_table: 1,
    });
  });
});
