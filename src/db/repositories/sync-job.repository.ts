import type { PrismaClient } from '@prisma/client';

export type SyncJobRecordData = {
  id: string;
  type: string;
  lane: string;
  status: string;
  cohort: number | null;
  repoId: number | null;
  githubId: string | null;
  blogSource: string | null;
  label: string | null;
  quiet: boolean;
  error: string | null;
  result: string | null;
  detail: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

// 싱크 큐의 기록. 큐가 전이마다 upsert하고, 부팅 때 되살린다
export function createSyncJobRepository(db: PrismaClient) {
  return {
    upsert: (data: SyncJobRecordData) =>
      db.syncJobRecord.upsert({ where: { id: data.id }, create: data, update: data }),

    /** since 이후에 만들어진 기록, 오래된 것부터 */
    findRecent: (since: Date) =>
      db.syncJobRecord.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } }),

    /** 대기·실행 중으로 남은 기록을 실패로 닫는다 (프로세스가 죽어 끝을 못 적은 작업) */
    closeUnfinished: async (error: string, now: Date) => {
      const { count } = await db.syncJobRecord.updateMany({
        where: { status: { in: ['queued', 'running'] } },
        data: { status: 'failed', error, completedAt: now },
      });
      return count;
    },

    deleteCompletedBefore: async (before: Date) => {
      const { count } = await db.syncJobRecord.deleteMany({ where: { completedAt: { lt: before } } });
      return count;
    },
  };
}

export type SyncJobRepository = ReturnType<typeof createSyncJobRepository>;
