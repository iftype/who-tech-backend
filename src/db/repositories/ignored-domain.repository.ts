import type { PrismaClient } from '@prisma/client';

export function createIgnoredDomainRepository(db: PrismaClient) {
  return {
    findAll: (workspaceId: number) =>
      db.ignoredDomain.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
      }),

    create: (workspaceId: number, domain: string) => db.ignoredDomain.create({ data: { domain, workspaceId } }),

    delete: (id: number) => db.ignoredDomain.delete({ where: { id } }),
  };
}

export type IgnoredDomainRepository = ReturnType<typeof createIgnoredDomainRepository>;
