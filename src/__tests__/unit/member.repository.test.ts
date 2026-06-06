import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import { createMemberRepository } from '../../db/repositories/member.repository.js';

describe('createMemberRepository where 빌더', () => {
  const count = jest.fn<() => Promise<number>>().mockResolvedValue(0);
  const findMany = jest.fn<() => Promise<never[]>>().mockResolvedValue([]);
  const db = { member: { count, findMany } } as unknown as PrismaClient;
  const repo = createMemberRepository(db);
  const WORKSPACE_ID = 1;

  beforeEach(() => {
    count.mockClear();
    findMany.mockClear();
  });

  const lastWhere = (mock: typeof count | typeof findMany) =>
    (mock.mock.calls[0]?.[0] as { where?: Record<string, unknown> } | undefined)?.where ?? {};

  it('should keep cohort filter when roleGroup is also applied (regression)', async () => {
    await repo.countWithFilters(WORKSPACE_ID, { cohort: 7, roleGroup: 'crew' });

    expect(lastWhere(count)).toMatchObject({
      workspaceId: WORKSPACE_ID,
      memberCohorts: { some: { cohort: { number: 7 }, role: { name: 'crew' } } },
    });
  });

  it('should combine cohort and staff roleGroup into a single memberCohorts clause', async () => {
    await repo.countWithFilters(WORKSPACE_ID, { cohort: 8, roleGroup: 'staff' });

    expect(lastWhere(count)).toMatchObject({
      memberCohorts: { some: { cohort: { number: 8 }, role: { name: { in: ['coach', 'reviewer'] } } } },
    });
  });

  it('should filter by cohort only when no role is given', async () => {
    await repo.findWithFiltersLightPage(WORKSPACE_ID, { cohort: 7 }, { limit: 10, offset: 0 });

    expect(lastWhere(findMany)).toMatchObject({
      memberCohorts: { some: { cohort: { number: 7 } } },
    });
    expect((lastWhere(findMany).memberCohorts as { some: { role?: unknown } }).some.role).toBeUndefined();
  });

  it('should not add a memberCohorts clause when neither cohort nor role is given', async () => {
    await repo.countWithFilters(WORKSPACE_ID, { track: 'backend' });

    expect(lastWhere(count)).not.toHaveProperty('memberCohorts');
  });
});
