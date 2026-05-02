import type { PrismaClient } from '@prisma/client';

export function createCohortRepoRepository(db: PrismaClient) {
  return {
    findByCohort: (workspaceId: number, cohort: number) =>
      db.cohortRepo.findMany({
        where: { workspaceId, cohort },
        orderBy: { order: 'asc' },
        include: {
          missionRepo: { select: { id: true, name: true, repoUrl: true, track: true, tabCategory: true } },
        },
      }),

    findById: (id: number) => db.cohortRepo.findUnique({ where: { id } }),

    create: (data: {
      cohort: number;
      order: number;
      missionRepoId: number;
      workspaceId: number;
      level?: number | null;
    }) =>
      db.cohortRepo.create({
        data,
        include: {
          missionRepo: { select: { id: true, name: true, repoUrl: true, track: true, tabCategory: true } },
        },
      }),

    update: (id: number, data: { order?: number; level?: number | null }) =>
      db.cohortRepo.update({
        where: { id },
        data,
        include: {
          missionRepo: { select: { id: true, name: true, repoUrl: true, track: true, tabCategory: true } },
        },
      }),

    delete: (id: number) => db.cohortRepo.delete({ where: { id } }),

    findExistingIds: (workspaceId: number, cohort: number) =>
      db.cohortRepo.findMany({ where: { workspaceId, cohort }, select: { missionRepoId: true } }),

    createMany: (
      rows: { cohort: number; order: number; missionRepoId: number; workspaceId: number; level?: number | null }[],
    ) => db.$transaction(rows.map((data) => db.cohortRepo.create({ data }))),

    listCohorts: (workspaceId: number) =>
      db.cohortRepo.findMany({
        where: { workspaceId },
        select: { cohort: true },
        distinct: ['cohort'],
        orderBy: { cohort: 'desc' },
      }),
  };
}

export type CohortRepoRepository = ReturnType<typeof createCohortRepoRepository>;
