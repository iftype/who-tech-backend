import type { PrismaClient, Prisma } from '@prisma/client';

export function createSubmissionRepository(db: PrismaClient) {
  return {
    upsert: (args: Prisma.SubmissionUpsertArgs) => db.submission.upsert(args),
    findById: (id: number) => db.submission.findUnique({ where: { id }, select: { id: true, memberId: true } }),
    deleteById: (id: number) => db.submission.delete({ where: { id } }).catch(() => null),
  };
}

export type SubmissionRepository = ReturnType<typeof createSubmissionRepository>;
