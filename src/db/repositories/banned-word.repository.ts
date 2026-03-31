import type { PrismaClient } from '@prisma/client';

export function createBannedWordRepository(db: PrismaClient) {
  return {
    findAll: (workspaceId: number) =>
      db.nicknameBannedWord.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
      }),

    create: (workspaceId: number, word: string) => db.nicknameBannedWord.create({ data: { word, workspaceId } }),

    delete: (id: number) => db.nicknameBannedWord.delete({ where: { id } }),
  };
}

export type BannedWordRepository = ReturnType<typeof createBannedWordRepository>;
