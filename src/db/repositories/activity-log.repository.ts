import type { PrismaClient } from '@prisma/client';

const RETENTION_MONTHS = 3;

function monthsAgo(months: number): Date {
  const now = new Date();
  now.setMonth(now.getMonth() - months);
  return now;
}

export function createActivityLogRepository(db: PrismaClient) {
  return {
    findMany: (workspaceId: number, limit = 200) =>
      db.activityLog.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          type: true,
          message: true,
          source: true,
          memberGithubId: true,
          metadata: true,
          createdAt: true,
        },
      }),

    create: async (data: {
      type: string;
      message: string;
      workspaceId: number;
      source?: string | null;
      memberGithubId?: string | null;
      metadata?: string | null;
    }) => {
      const [log] = await db.$transaction([
        db.activityLog.create({ data }),
        db.activityLog.deleteMany({
          where: {
            workspaceId: data.workspaceId,
            createdAt: { lt: monthsAgo(RETENTION_MONTHS) },
          },
        }),
      ]);
      return log;
    },

    deleteAll: (workspaceId: number) => db.activityLog.deleteMany({ where: { workspaceId } }),

    // Rate limiting: 특정 멤버의 최근 요청 횟수
    countByMember: (memberGithubId: string, since: Date) =>
      db.activityLog.count({
        where: {
          memberGithubId,
          type: { in: ['refresh_member', 'rate_limit_member'] },
          createdAt: { gte: since },
        },
      }),

    // Rate limiting: 특정 멤버의 가장 최근 요청 시간
    findLatestByMember: (memberGithubId: string) =>
      db.activityLog.findFirst({
        where: {
          memberGithubId,
          type: { in: ['refresh_member', 'rate_limit_member'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),

    // 타입별 로그 조회
    findManyByType: (type: string, workspaceId: number, limit = 100) =>
      db.activityLog.findMany({
        where: { workspaceId, type },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          type: true,
          message: true,
          source: true,
          memberGithubId: true,
          metadata: true,
          createdAt: true,
        },
      }),
  };
}

export type ActivityLogRepository = ReturnType<typeof createActivityLogRepository>;
