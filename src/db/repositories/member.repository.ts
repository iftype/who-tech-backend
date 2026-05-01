import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

const memberListInclude = Prisma.validator<Prisma.MemberInclude>()({
  memberCohorts: {
    include: {
      cohort: true,
      role: true,
    },
  },
  submissions: {
    orderBy: { submittedAt: 'desc' as const },
    take: 20,
    select: {
      id: true,
      status: true,
      missionRepoId: true,
      missionRepo: { select: { id: true, track: true } },
    },
  },
});

const memberDetailInclude = Prisma.validator<Prisma.MemberInclude>()({
  _count: { select: { submissions: true } },
  blogPosts: { orderBy: { publishedAt: 'desc' as const }, take: 10 },
  person: {
    include: {
      members: {
        select: { id: true, githubId: true, nickname: true, manualNickname: true, avatarUrl: true },
      },
    },
  },
  memberCohorts: {
    include: {
      cohort: true,
      role: true,
    },
  },
  submissions: {
    orderBy: { submittedAt: 'desc' as const },
    take: 50,
    select: {
      id: true,
      prNumber: true,
      prUrl: true,
      title: true,
      status: true,
      submittedAt: true,
      memberId: true,
      missionRepoId: true,
      missionRepo: { select: { id: true, name: true, track: true, level: true, tabCategory: true } },
    },
  },
});

export type MemberWithRelations = Prisma.MemberGetPayload<{
  include: typeof memberListInclude;
}>;

export type MemberDetailWithRelations = Prisma.MemberGetPayload<{
  include: typeof memberDetailInclude;
}>;

export function createMemberRepository(db: PrismaClient) {
  return {
    // 필터 기반 조회
    findWithFilters: (
      workspaceId: number,
      filters?: {
        q?: string;
        cohort?: number;
        hasBlog?: boolean;
        track?: string;
        role?: string;
        roleGroup?: 'crew' | 'staff';
      },
    ): Promise<MemberDetailWithRelations[]> =>
      db.member.findMany({
        where: {
          workspaceId,
          ...(filters?.cohort ? { memberCohorts: { some: { cohort: { number: filters.cohort } } } } : {}),
          ...(filters?.role ? { memberCohorts: { some: { role: { name: { contains: filters.role } } } } } : {}),
          ...(filters?.roleGroup === 'crew'
            ? { memberCohorts: { some: { role: { name: 'crew' } } } }
            : filters?.roleGroup === 'staff'
              ? { memberCohorts: { some: { role: { name: { in: ['coach', 'reviewer'] } } } } }
              : {}),
          ...(filters?.hasBlog === true ? { blog: { not: null } } : {}),
          ...(filters?.hasBlog === false ? { blog: null } : {}),
          ...(filters?.track ? { track: filters.track } : {}),
          ...(filters?.q
            ? {
                OR: [
                  { githubId: { contains: filters.q } },
                  { previousIds: { some: { githubId: { contains: filters.q } } } },
                  { nickname: { contains: filters.q } },
                  { manualNickname: { contains: filters.q } },
                ] satisfies Prisma.MemberWhereInput[],
              }
            : {}),
        },
        orderBy: [{ nickname: 'asc' }],
        include: memberDetailInclude,
      }),

    findWithFiltersLight: (
      workspaceId: number,
      filters?: {
        q?: string;
        cohort?: number;
        hasBlog?: boolean;
        track?: string;
        role?: string;
        roleGroup?: 'crew' | 'staff';
      },
    ): Promise<MemberWithRelations[]> =>
      db.member.findMany({
        where: {
          workspaceId,
          ...(filters?.cohort ? { memberCohorts: { some: { cohort: { number: filters.cohort } } } } : {}),
          ...(filters?.role ? { memberCohorts: { some: { role: { name: { contains: filters.role } } } } } : {}),
          ...(filters?.roleGroup === 'crew'
            ? { memberCohorts: { some: { role: { name: 'crew' } } } }
            : filters?.roleGroup === 'staff'
              ? { memberCohorts: { some: { role: { name: { in: ['coach', 'reviewer'] } } } } }
              : {}),
          ...(filters?.hasBlog === true ? { blog: { not: null } } : {}),
          ...(filters?.hasBlog === false ? { blog: null } : {}),
          ...(filters?.track ? { track: filters.track } : {}),
          ...(filters?.q
            ? {
                OR: [
                  { githubId: { contains: filters.q } },
                  { previousIds: { some: { githubId: { contains: filters.q } } } },
                  { nickname: { contains: filters.q } },
                  { manualNickname: { contains: filters.q } },
                ] satisfies Prisma.MemberWhereInput[],
              }
            : {}),
        },
        orderBy: [{ nickname: 'asc' }],
        include: memberListInclude,
      }),

    // 기본 조회 메서드들
    findByGithubId: (githubId: string, workspaceId: number): Promise<MemberDetailWithRelations | null> =>
      db.member.findUnique({
        where: { githubId_workspaceId: { githubId, workspaceId } },
        include: memberDetailInclude,
      }),

    findByGithubUserId: (githubUserId: number, workspaceId: number): Promise<MemberDetailWithRelations | null> =>
      db.member.findUnique({
        where: { githubUserId_workspaceId: { githubUserId, workspaceId } },
        include: memberDetailInclude,
      }),

    findByIdWithRelations: (id: number): Promise<MemberDetailWithRelations | null> =>
      db.member.findUnique({ where: { id }, include: memberDetailInclude }),

    create: (data: Prisma.MemberUncheckedCreateInput): Promise<MemberDetailWithRelations> =>
      db.member.create({ data, include: memberDetailInclude }),

    update: (id: number, data: Prisma.MemberUncheckedUpdateInput): Promise<MemberDetailWithRelations> =>
      db.member.update({ where: { id }, data, include: memberDetailInclude }),

    listStaleProfiles: (
      workspaceId: number,
      params: { staleBefore: Date; cohort?: number; limit: number },
    ): Promise<MemberWithRelations[]> =>
      db.member.findMany({
        where: {
          workspaceId,
          profileFetchedAt: { lt: params.staleBefore },
          ...(params.cohort ? { memberCohorts: { some: { cohort: { number: params.cohort } } } } : {}),
        },
        orderBy: { profileFetchedAt: 'asc' },
        take: params.limit,
        include: memberListInclude,
      }),

    findPublicDetail: (githubId: string, workspaceId: number): Promise<MemberDetailWithRelations | null> =>
      db.member.findUnique({
        where: { githubId_workspaceId: { githubId, workspaceId } },
        include: memberDetailInclude,
      }),

    findManyByNickname: (nickname: string, workspaceId: number): Promise<MemberWithRelations[]> =>
      db.member.findMany({
        where: {
          workspaceId,
          OR: [{ nickname }, { manualNickname: nickname }],
        },
        include: memberListInclude,
      }),

    upsert: async (
      workspaceId: number,
      githubUserId: number,
      data: Prisma.MemberUncheckedCreateInput,
    ): Promise<MemberDetailWithRelations> => {
      const updateData: Prisma.MemberUncheckedUpdateInput = {
        githubId: data.githubId,
        previousGithubIds: data.previousGithubIds ?? null,
        nickname: data.nickname ?? null,
        avatarUrl: data.avatarUrl ?? null,
        nicknameStats: data.nicknameStats ?? null,
        profileFetchedAt: data.profileFetchedAt ?? null,
        profileRefreshError: data.profileRefreshError ?? null,
        blog: data.blog ?? null,
      };

      const result = await db.member.upsert({
        where: {
          githubUserId_workspaceId: { githubUserId, workspaceId },
        },
        update: updateData,
        create: {
          ...data,
          workspaceId,
        },
        include: memberDetailInclude,
      });

      return result as unknown as MemberDetailWithRelations;
    },

    upsertParticipation: async (memberId: number, cohortNumber: number, roleName: string) => {
      const cohort = await db.cohort.upsert({
        where: { number: cohortNumber },
        create: { number: cohortNumber },
        update: {},
      });

      const role = await db.role.upsert({
        where: { name: roleName },
        create: { name: roleName },
        update: {},
      });

      return db.memberCohort.upsert({
        where: { memberId_cohortId_roleId: { memberId, cohortId: cohort.id, roleId: role.id } },
        create: { memberId, cohortId: cohort.id, roleId: role.id },
        update: {},
      });
    },

    // 이전 GitHub ID 동기화 (previousGithubIds JSON + PreviousGithubId 테이블)
    syncPreviousGithubIds: async (memberId: number, previousIdsJson: string | null) => {
      const existing = await db.previousGithubId.findMany({ where: { memberId } });
      const existingIds = new Set(existing.map((r) => r.githubId));
      const newIds = previousIdsJson ? (JSON.parse(previousIdsJson) as string[]) : [];
      const newIdSet = new Set(newIds);

      const toDelete = existing.filter((r) => !newIdSet.has(r.githubId));
      const toAdd = newIds.filter((id) => !existingIds.has(id));

      if (toDelete.length > 0) {
        await db.previousGithubId.deleteMany({
          where: { memberId, githubId: { in: toDelete.map((r) => r.githubId) } },
        });
      }
      for (const githubId of toAdd) {
        await db.previousGithubId.create({ data: { githubId, memberId } }).catch(() => null);
      }
    },

    // 특정 기수에 대한 참여 정보 전체 삭제 (역할 교체 시 사용)
    deleteParticipationsByCohort: async (memberId: number, cohortNumber: number) => {
      const cohort = await db.cohort.findUnique({ where: { number: cohortNumber } });
      if (!cohort) return;
      return db.memberCohort.deleteMany({ where: { memberId, cohortId: cohort.id } });
    },

    // 삭제 로직 (트랜잭션으로 연관 데이터까지 깔끔하게)
    deleteWithRelations: (id: number) =>
      db.$transaction([
        db.blogPost.deleteMany({ where: { memberId: id } }),
        db.submission.deleteMany({ where: { memberId: id } }),
        db.member.delete({ where: { id } }),
      ]),

    deleteAllWithRelations: (workspaceId: number) =>
      db.$transaction([
        db.blogPost.deleteMany({ where: { member: { workspaceId } } }),
        db.submission.deleteMany({ where: { member: { workspaceId } } }),
        db.member.deleteMany({ where: { workspaceId } }),
      ]),

    // 기타 편의 메서드
    patch: (id: number, data: Partial<Prisma.MemberUpdateInput>) => db.member.update({ where: { id }, data }),

    count: () => db.member.count(),

    listMemberCohorts: (workspaceId: number): Promise<number[]> =>
      db.memberCohort
        .findMany({
          where: { member: { workspaceId } },
          select: { cohort: { select: { number: true } } },
          distinct: ['cohortId'],
        })
        .then((rows) => [...new Set(rows.map((r) => r.cohort.number))].sort((a, b) => a - b)),
  };
}

export type MemberRepository = ReturnType<typeof createMemberRepository>;
