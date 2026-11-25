// SQLite 잠금이 풀리지 않을 때 Prisma 커넥션 풀을 닫아 스스로 푼다 (#267, #268)
//
// Prisma(SQLite)는 "database is locked"(SQLITE_BUSY)를 P1008 "Socket timeout"으로 던진다.
// 커넥션 하나가 커밋하지 못한 쓰기 트랜잭션을 쥔 채 풀에 남으면, 다른 커넥션의 쿼리는 전부 P1008로 실패하고
// 프로세스를 다시 띄우기 전까지 풀리지 않는다 (2026-11-25 06:37부터 6시간 넘게 모든 싱크가 실패했다).
// 정상 경합은 길어야 트랜잭션 timeout(20초) 안에 끝나므로, P1008이 1분 넘게 이어지면 막힌 것으로 보고
// $disconnect로 풀을 닫는다. 닫힌 커넥션의 트랜잭션은 되돌려지고 잠금이 풀리며, 다음 쿼리가 새로 연결한다.

export function isDbBusyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P1008';
}

export type DbLockRecovery = {
  /** 쿼리·작업이 실패했을 때. P1008이 아니면 무시한다 */
  onError: (error: unknown) => void;
  /** DB를 쓰는 작업이 끝까지 성공했을 때. 이어지던 P1008 기록을 지운다 */
  onSuccess: () => void;
};

/** P1008이 이 시간 넘게 이어지면 막힌 것으로 본다 (트랜잭션 timeout 20초보다 넉넉히) */
export const STUCK_AFTER_MS = 60_000;
/** P1008 사이가 이만큼 벌어지면 따로 일어난 경합으로 본다 (10분 cron 두 번이 이어지게 그보다 길게) */
export const QUIET_GAP_MS = 15 * 60_000;

export function createDbLockRecovery(deps: {
  reset: () => Promise<void>;
  now?: () => number;
  stuckAfterMs?: number;
  quietGapMs?: number;
  logger?: Pick<Console, 'error'>;
}): DbLockRecovery {
  const { reset, now = Date.now, stuckAfterMs = STUCK_AFTER_MS, quietGapMs = QUIET_GAP_MS, logger = console } = deps;
  let firstBusyAt: number | null = null;
  let lastBusyAt = 0;
  let resetting = false;

  return {
    onError: (error) => {
      if (!isDbBusyError(error)) return;
      const at = now();
      if (firstBusyAt === null || at - lastBusyAt > quietGapMs) firstBusyAt = at;
      lastBusyAt = at;
      if (resetting || at - firstBusyAt < stuckAfterMs) return;

      logger.error(`[db] SQLite 잠금이 ${Math.round((at - firstBusyAt) / 1000)}초째 풀리지 않아 커넥션 풀을 닫는다`);
      firstBusyAt = null;
      resetting = true;
      reset()
        .catch((e: unknown) => logger.error('[db] 커넥션 풀 닫기 실패', e instanceof Error ? e.message : e))
        .finally(() => {
          resetting = false;
        });
    },
    onSuccess: () => {
      firstBusyAt = null;
    },
  };
}
