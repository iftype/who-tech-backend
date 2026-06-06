import type { PrismaClient, Prisma } from '@prisma/client';

export type TecoTalkUpsertData = {
  videoId: string;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  speakerNickname: string | null;
  uploadedAt: Date;
  viewCount: number;
  cohort: number | null;
  matchStatus: string;
  workspaceId: number;
};

const tecoTalkWithSpeakersSelect = {
  id: true,
  videoId: true,
  title: true,
  url: true,
  thumbnailUrl: true,
  speakerNickname: true,
  uploadedAt: true,
  viewCount: true,
  cohort: true,
  matchStatus: true,
  speakers: {
    select: {
      member: {
        select: { githubId: true, nickname: true, manualNickname: true, avatarUrl: true },
      },
    },
  },
} satisfies Prisma.TecoTalkSelect;

export type TecoTalkWithSpeakers = Prisma.TecoTalkGetPayload<{ select: typeof tecoTalkWithSpeakersSelect }>;

// 멤버 프로필 뱃지용 경량 select (멤버 정보 없이 영상 기본 정보만)
const tecoTalkBadgeSelect = {
  id: true,
  videoId: true,
  title: true,
  url: true,
  thumbnailUrl: true,
  uploadedAt: true,
  viewCount: true,
  cohort: true,
} satisfies Prisma.TecoTalkSelect;

export type TecoTalkBadge = Prisma.TecoTalkGetPayload<{ select: typeof tecoTalkBadgeSelect }>;

export function createTecoTalkRepository(db: PrismaClient) {
  return {
    // 영상 메타/조회수 upsert (발표자 연결은 setSpeakers 로 별도 처리). id 반환.
    upsertByVideoId: (data: TecoTalkUpsertData): Promise<{ id: number }> =>
      db.tecoTalk.upsert({
        where: { videoId: data.videoId },
        create: data,
        update: {
          title: data.title,
          url: data.url,
          thumbnailUrl: data.thumbnailUrl,
          speakerNickname: data.speakerNickname,
          uploadedAt: data.uploadedAt,
          viewCount: data.viewCount,
          cohort: data.cohort,
          matchStatus: data.matchStatus,
        },
        select: { id: true },
      }),

    // 발표자 멤버 목록을 통째로 교체 (sync 멱등성 보장)
    setSpeakers: async (tecoTalkId: number, memberIds: number[]): Promise<void> => {
      await db.tecoTalkSpeaker.deleteMany({ where: { tecoTalkId } });
      if (memberIds.length > 0) {
        await db.tecoTalkSpeaker.createMany({
          data: memberIds.map((memberId) => ({ tecoTalkId, memberId })),
        });
      }
    },

    findByWorkspace: (
      workspaceId: number,
      filters?: { cohort?: number; matchStatus?: string },
    ): Promise<TecoTalkWithSpeakers[]> =>
      db.tecoTalk.findMany({
        where: {
          workspaceId,
          ...(filters?.cohort !== undefined ? { cohort: filters.cohort } : {}),
          ...(filters?.matchStatus ? { matchStatus: filters.matchStatus } : {}),
        },
        orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
        select: tecoTalkWithSpeakersSelect,
      }),

    // 특정 멤버가 발표한 테코톡 (프로필 뱃지용)
    findByMemberId: (memberId: number): Promise<TecoTalkBadge[]> =>
      db.tecoTalk.findMany({
        where: { speakers: { some: { memberId } } },
        orderBy: [{ uploadedAt: 'desc' }],
        select: tecoTalkBadgeSelect,
      }),

    countByWorkspace: (workspaceId: number): Promise<number> => db.tecoTalk.count({ where: { workspaceId } }),
  };
}

export type TecoTalkRepository = ReturnType<typeof createTecoTalkRepository>;
