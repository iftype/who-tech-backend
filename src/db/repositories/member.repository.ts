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
      missionRepo: { select: { id: true, name: true, track: true, tabCategory: true } },
    },
  },
});

export type MemberWithRelations = Prisma.MemberGetPayload<{
  include: typeof memberListInclude;
}>;

export type MemberDetailWithRelations = Prisma.MemberGetPayload<{
  include: typeof memberDetailInclude;
}>;

type MemberFilters = {
  q?: string;
  cohort?: number;
  hasBlog?: boolean;
  track?: string;
  role?: string;
  roleGroup?: 'crew' | 'staff';
  // 앱 레이어에서 nicknameStats 상위 토큰 매칭으로 미리 계산한 추가 매칭 대상 githubId.
  // q 검색의 OR 절에 합류해 실명/부분 매칭을 더한다. (페이지네이션·카운트와 일관 유지)
  nameMatchGithubIds?: string[];
};

function buildMemberWhere(workspaceId: number, filters?: MemberFilters): Prisma.MemberWhereInput {
  // cohort/role/roleGroup은 동일한 memberCohort 레코드에 걸려야 하므로 하나의 some 절로 합친다.
  // (각각 별도 some 절로 두면 객체 키 충돌로 cohort 필터가 덮어써져 무시된다)
  const cohortCondition: Prisma.MemberCohortWhereInput = {};
  if (filters?.cohort) cohortCondition.cohort = { number: filters.cohort };
  if (filters?.role) {
    cohortCondition.role = { name: { contains: filters.role } };
  } else if (filters?.roleGroup === 'crew') {
    cohortCondition.role = { name: 'crew' };
  } else if (filters?.roleGroup === 'staff') {
    cohortCondition.role = { name: { in: ['coach', 'reviewer'] } };
  }
  const hasCohortCondition = Object.keys(cohortCondition).length > 0;

  return {
    workspaceId,
    ...(hasCohortCondition ? { memberCohorts: { some: cohortCondition } } : {}),
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
            ...(filters.nameMatchGithubIds && filters.nameMatchGithubIds.length > 0
              ? [{ githubId: { in: filters.nameMatchGithubIds } }]
              : []),
          ] satisfies Prisma.MemberWhereInput[],
        }
      : {}),
  };
}

export function createMemberRepository(db: PrismaClient) {
  return {
    // 필터 기반 조회
    findWithFilters: (workspaceId: number, filters?: MemberFilters): Promise<MemberDetailWithRelations[]> =>
      db.member.findMany({
        where: buildMemberWhere(workspaceId, filters),
        orderBy: [{ nickname: 'asc' }],
        include: memberDetailInclude,
      }),

    findWithFiltersLight: (workspaceId: number, filters?: MemberFilters): Promise<MemberWithRelations[]> =>
      db.member.findMany({
        where: buildMemberWhere(workspaceId, filters),
        orderBy: [{ nickname: 'asc' }],
        include: memberListInclude,
      }),

    findWithFiltersLightPage: (
      workspaceId: number,
      filters: MemberFilters | undefined,
      pagination: { limit: number; offset: number },
    ): Promise<MemberWithRelations[]> =>
      db.member.findMany({
        where: buildMemberWhere(workspaceId, filters),
        orderBy: [{ nickname: 'asc' }],
        skip: pagination.offset,
        take: pagination.limit,
        include: memberListInclude,
      }),

    countWithFilters: (workspaceId: number, filters?: MemberFilters): Promise<number> =>
      db.member.count({ where: buildMemberWhere(workspaceId, filters) }),

    // 이름(실명/부분) 검색 매칭용 경량 소스: githubId + nicknameStats(JSON 문자열)
    findNameSearchSource: (workspaceId: number): Promise<{ githubId: string; nicknameStats: string | null }[]> =>
      db.member.findMany({
        where: { workspaceId },
        select: { githubId: true, nicknameStats: true },
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
        .then((rows) => [...new Set(rows.map((r) => r.cohort.number))].sort((a, b) => b - a)),
  };
}

export type MemberRepository = ReturnType<typeof createMemberRepository>;
