import { describe, it, expect, beforeEach } from '@jest/globals';
import prisma from '../../db/prisma.js';
import { createSyncJobRepository, type SyncJobRecordData } from '../../db/repositories/sync-job.repository.js';

// jest setupFiles가 테스트 파일마다 임시 SQLite를 붙인다 (실제 DB와 무관)
const repo = createSyncJobRepository(prisma);

function record(id: string, overrides: Partial<SyncJobRecordData> = {}): SyncJobRecordData {
  const createdAt = new Date('2026-10-22T00:00:00Z');
  return {
    id,
    type: 'workspace',
    lane: 'github',
    status: 'queued',
    cohort: null,
    repoId: null,
    githubId: null,
    blogSource: null,
    label: null,
    quiet: false,
    error: null,
    result: null,
    detail: null,
    createdAt,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

beforeEach(async () => {
  await prisma.syncJobRecord.deleteMany();
});

describe('sync-job repository', () => {
  it('should upsert the same id in place and list recent records oldest first', async () => {
    await repo.upsert(record('a'));
    await repo.upsert(record('a', { status: 'running', startedAt: new Date('2026-10-22T00:00:01Z') }));
    await repo.upsert(record('b', { createdAt: new Date('2026-10-22T00:00:05Z') }));
    await repo.upsert(record('ancient', { createdAt: new Date('2026-01-01T00:00:00Z') }));

    const rows = await repo.findRecent(new Date('2026-10-21T00:00:00Z'));

    expect(rows.map((r) => [r.id, r.status])).toEqual([
      ['a', 'running'],
      ['b', 'queued'],
    ]);
  });

  it('should close queued and running records as failed and leave finished ones alone', async () => {
    const now = new Date('2026-10-22T01:00:00Z');
    await repo.upsert(record('q'));
    await repo.upsert(record('r', { status: 'running' }));
    await repo.upsert(record('done', { status: 'completed', completedAt: new Date('2026-10-22T00:30:00Z') }));

    const closed = await repo.closeUnfinished('server restarted', now);

    expect(closed).toBe(2);
    const rows = await prisma.syncJobRecord.findMany({ orderBy: { id: 'asc' } });
    expect(rows.map((r) => [r.id, r.status, r.error, r.completedAt?.toISOString() ?? null])).toEqual([
      ['done', 'completed', null, '2026-10-22T00:30:00.000Z'],
      ['q', 'failed', 'server restarted', now.toISOString()],
      ['r', 'failed', 'server restarted', now.toISOString()],
    ]);
  });

  it('should delete records completed before the cutoff', async () => {
    await repo.upsert(record('old', { status: 'completed', completedAt: new Date('2026-10-21T00:00:00Z') }));
    await repo.upsert(record('new', { status: 'completed', completedAt: new Date('2026-10-22T00:00:00Z') }));
    await repo.upsert(record('open'));

    const deleted = await repo.deleteCompletedBefore(new Date('2026-10-21T12:00:00Z'));

    expect(deleted).toBe(1);
    expect((await prisma.syncJobRecord.findMany()).map((r) => r.id).sort()).toEqual(['new', 'open']);
  });
});
