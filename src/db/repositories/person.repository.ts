import type { PrismaClient } from '@prisma/client';

export function createPersonRepository(db: PrismaClient) {
  const include = {
    members: {
      select: {
        id: true,
        githubId: true,
        nickname: true,
        manualNickname: true,
        avatarUrl: true,
        memberCohorts: {
          include: { cohort: true, role: true },
        },
      },
    },
  } as const;

  return {
    findAll: (workspaceId: number) =>
      db.person.findMany({
        where: { workspaceId },
        include,
        orderBy: { createdAt: 'desc' },
      }),

    findById: (id: number) => db.person.findUnique({ where: { id }, include }),

    create: (workspaceId: number, data: { displayName?: string; note?: string }) =>
      db.person.create({ data: { ...data, workspaceId }, include }),

    update: (id: number, data: { displayName?: string | null; note?: string | null }) =>
      db.person.update({ where: { id }, data, include }),

    delete: async (id: number) => {
      // 연결된 멤버들의 personId 먼저 해제
      await db.member.updateMany({ where: { personId: id }, data: { personId: null } });
      return db.person.delete({ where: { id } });
    },

    linkMember: (personId: number, memberId: number) =>
      db.member.update({ where: { id: memberId }, data: { personId } }),

    unlinkMember: (memberId: number) => db.member.update({ where: { id: memberId }, data: { personId: null } }),
  };
}

export type PersonRepository = ReturnType<typeof createPersonRepository>;
