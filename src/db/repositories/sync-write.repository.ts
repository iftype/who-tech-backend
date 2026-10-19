import type { Prisma, PrismaClient } from '@prisma/client';

// 레포 싱크의 읽기·쓰기. PR 한 건을 처리할 때 필요한 것만 읽고(슬림 select), 쓰기는 트랜잭션 하나로 묶는다.
// - 예전: 멤버를 상세 include(블로그 10·제출 50·Person)로 최대 두 번 읽고, 쓰기 5~6단계를 트랜잭션 없이 실행
//   → PR마다 쿼리가 많고, 중간에 실패하면 멤버만 바뀌고 제출은 없는 반쪽 상태가 남았다
// - 기수·역할 id는 한 번 싱크하는 동안 캐시한다 (PR마다 upsert 두 번 하던 것)

const syncTargetSelect = {
  id: true,
  githubId: true,
  githubUserId: true,
  nickname: true,
  manualNickname: true,
  nicknameStats: true,
  blog: true,
  avatarUrl: true,
  profileFetchedAt: true,
  profileRefreshError: true,
  previousIds: { select: { githubId: true }, orderBy: { id: 'asc' } },
} satisfies Prisma.MemberSelect;

type SyncTargetRow = Prisma.MemberGetPayload<{ select: typeof syncTargetSelect }>;

export type SyncTarget = Omit<SyncTargetRow, 'previousIds'> & { previousGithubIds: string[] };

export type SyncedPullRequest = {
  workspaceId: number;
  githubUserId: number;
  member: {
    githubId: string;
    nickname: string | null;
    avatarUrl: string | null;
    nicknameStats: string | null;
    profileFetchedAt: Date | null;
    profileRefreshError: string | null;
    blog: string | null;
  };
  previousGithubIds: readonly string[];
  /** 크루로 참여한 기수 (없으면 참여 기록을 남기지 않는다) */
  cohort: number | null;
  submission: {
    prNumber: number;
    prUrl: string;
    title: string;
    status: string;
    submittedAt: Date;
    missionRepoId: number;
  };
};

/** 한 번의 싱크 동안 기수 번호·역할 이름 → id */
export type ParticipationIdCache = { cohorts: Map<number, number>; roles: Map<string, number> };

export const createParticipationIdCache = (): ParticipationIdCache => ({ cohorts: new Map(), roles: new Map() });

const CREW_ROLE = 'crew';

const toTarget = (row: SyncTargetRow | null): SyncTarget | null => {
  if (!row) return null;
  const { previousIds, ...rest } = row;
  return { ...rest, previousGithubIds: previousIds.map((p) => p.githubId) };
};

export function createSyncWriteRepository(db: PrismaClient) {
  return {
    // GitHub user id로 먼저, 없으면 로그인 아이디로 찾는다 (아이디를 바꾼 크루도 같은 멤버로)
    findTarget: async (
      githubUserId: number | null,
      githubId: string,
      workspaceId: number,
    ): Promise<SyncTarget | null> => {
      if (githubUserId != null) {
        const byUserId = await db.member.findUnique({
          where: { githubUserId_workspaceId: { githubUserId, workspaceId } },
          select: syncTargetSelect,
        });
        if (byUserId) return toTarget(byUserId);
      }
      return toTarget(
        await db.member.findUnique({
          where: { githubId_workspaceId: { githubId, workspaceId } },
          select: syncTargetSelect,
        }),
      );
    },

    // 멤버 upsert → 이전 아이디 맞추기 → 기수 참여 → 제출 upsert. 하나라도 실패하면 모두 되돌린다.
    // 새로 만든 기수·역할 id는 커밋된 뒤에만 캐시에 넣는다 (되돌려진 행의 id를 다음 PR이 쓰지 않게)
    applyPullRequest: async (input: SyncedPullRequest, ids: ParticipationIdCache) => {
      const created = createParticipationIdCache();
      const result = await db.$transaction(
        async (tx) => {
          const { workspaceId, githubUserId, member, previousGithubIds, cohort, submission } = input;

          const { id: memberId } = await tx.member.upsert({
            where: { githubUserId_workspaceId: { githubUserId, workspaceId } },
            update: member,
            create: { ...member, githubUserId, workspaceId },
            select: { id: true },
          });

          const existing = await tx.previousGithubId.findMany({ where: { memberId }, select: { githubId: true } });
          const existingIds = new Set(existing.map((r) => r.githubId));
          const nextIds = new Set(previousGithubIds);
          const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
          if (toDelete.length > 0) {
            await tx.previousGithubId.deleteMany({ where: { memberId, githubId: { in: toDelete } } });
          }
          for (const githubId of nextIds) {
            if (!existingIds.has(githubId)) await tx.previousGithubId.create({ data: { githubId, memberId } });
          }

          if (cohort != null) {
            let cohortId = ids.cohorts.get(cohort);
            if (cohortId === undefined) {
              cohortId = (
                await tx.cohort.upsert({
                  where: { number: cohort },
                  create: { number: cohort },
                  update: {},
                  select: { id: true },
                })
              ).id;
              created.cohorts.set(cohort, cohortId);
            }
            let roleId = ids.roles.get(CREW_ROLE);
            if (roleId === undefined) {
              roleId = (
                await tx.role.upsert({
                  where: { name: CREW_ROLE },
                  create: { name: CREW_ROLE },
                  update: {},
                  select: { id: true },
                })
              ).id;
              created.roles.set(CREW_ROLE, roleId);
            }
            await tx.memberCohort.upsert({
              where: { memberId_cohortId_roleId: { memberId, cohortId, roleId } },
              create: { memberId, cohortId, roleId },
              update: {},
              select: { id: true },
            });
          }

          await tx.submission.upsert({
            where: {
              prNumber_missionRepoId: { prNumber: submission.prNumber, missionRepoId: submission.missionRepoId },
            },
            create: { ...submission, memberId },
            update: { memberId, title: submission.title, prUrl: submission.prUrl, status: submission.status },
            select: { id: true },
          });

          return { memberId };
        },
        // 블로그 싱크 등 다른 쓰기와 겹칠 수 있어 SQLite 잠금을 조금 더 기다린다
        { maxWait: 10_000, timeout: 20_000 },
      );
      created.cohorts.forEach((id, number) => ids.cohorts.set(number, id));
      created.roles.forEach((id, name) => ids.roles.set(name, id));
      return result;
    },
  };
}

export type SyncWriteRepository = ReturnType<typeof createSyncWriteRepository>;
