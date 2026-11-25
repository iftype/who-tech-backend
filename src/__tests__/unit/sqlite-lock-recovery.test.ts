import { describe, it, expect, jest } from '@jest/globals';
import { createDbLockRecovery, isDbBusyError, QUIET_GAP_MS, STUCK_AFTER_MS } from '../../db/sqlite-lock-recovery.js';
import { createSyncQueue } from '../../features/sync/sync.queue.js';

// 2026-11-25: 커넥션 하나가 커밋 못 한 쓰기 트랜잭션을 쥐고 남아 6시간 동안 모든 쿼리가 P1008로 실패했다 (#267, #268)
const busy = Object.assign(new Error('Socket timeout (the database failed to respond to a query)'), { code: 'P1008' });

function setup() {
  let clock = 0;
  const reset = jest.fn(async () => undefined);
  const recovery = createDbLockRecovery({ reset, now: () => clock, logger: { error: jest.fn() } });
  return {
    recovery,
    reset,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('SQLite 잠금 복구', () => {
  describe('isDbBusyError', () => {
    it('should treat only P1008 as a lock error', () => {
      expect(isDbBusyError(busy)).toBe(true);
      expect(isDbBusyError(Object.assign(new Error('x'), { code: 'P2025' }))).toBe(false);
      expect(isDbBusyError(new Error('x'))).toBe(false);
      expect(isDbBusyError(null)).toBe(false);
    });
  });

  describe('createDbLockRecovery', () => {
    it('should close the connection pool when P1008 lasts over a minute', () => {
      const { recovery, reset, advance } = setup();
      recovery.onError(busy);
      advance(STUCK_AFTER_MS - 1);
      recovery.onError(busy);
      expect(reset).not.toHaveBeenCalled();

      advance(1);
      recovery.onError(busy);
      expect(reset).toHaveBeenCalledTimes(1);
    });

    it('should close on the second cron run when two 10-minute runs hit the lock (production pattern)', () => {
      const { recovery, reset, advance } = setup();
      recovery.onError(busy); // 06:40 continuous
      advance(10 * 60_000);
      recovery.onError(busy); // 06:50 continuous
      expect(reset).toHaveBeenCalledTimes(1);
    });

    it('should forget the streak when a job succeeds after brief contention', () => {
      const { recovery, reset, advance } = setup();
      recovery.onError(busy);
      recovery.onSuccess();
      advance(STUCK_AFTER_MS);
      recovery.onError(busy);
      expect(reset).not.toHaveBeenCalled();
    });

    it('should treat far-apart P1008 errors as separate contention', () => {
      const { recovery, reset, advance } = setup();
      recovery.onError(busy);
      advance(QUIET_GAP_MS + 1);
      recovery.onError(busy);
      expect(reset).not.toHaveBeenCalled();
    });

    it('should ignore errors other than P1008', () => {
      const { recovery, reset, advance } = setup();
      recovery.onError(new Error('boom'));
      advance(STUCK_AFTER_MS * 2);
      recovery.onError(new Error('boom'));
      expect(reset).not.toHaveBeenCalled();
    });
  });

  describe('createSyncQueue — 잠금 복구 연결', () => {
    async function runJob(fail: boolean) {
      const recovery = { onError: jest.fn(), onSuccess: jest.fn() };
      const queue = createSyncQueue({
        syncService: {
          syncContinuousRepos: jest.fn(async () => {
            if (fail) throw busy;
            return { totalSynced: 0, reposSynced: 0 };
          }),
        } as never,
        activityLogService: { addLog: jest.fn(async () => undefined) } as never,
        workspaceService: { getOrThrow: jest.fn(async () => ({ id: 1 })) } as never,
        octokit: {} as never,
        repoService: { executeRepoSync: jest.fn() } as never,
        blogAdminService: { executeWorkspaceBlogSync: jest.fn() } as never,
        dbLockRecovery: recovery,
      });
      const id = queue.enqueue('continuous');
      await queue.waitFor(id).catch(() => undefined);
      return recovery;
    }

    it('should report the error when a job fails', async () => {
      const recovery = await runJob(true);
      expect(recovery.onError).toHaveBeenCalledWith(busy);
      expect(recovery.onSuccess).not.toHaveBeenCalled();
    });

    it('should report success when a job completes', async () => {
      const recovery = await runJob(false);
      expect(recovery.onSuccess).toHaveBeenCalled();
      expect(recovery.onError).not.toHaveBeenCalled();
    });
  });
});
