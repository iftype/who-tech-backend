import type { PrismaClient, Prisma } from '@prisma/client';

// 1. Feed 전용 select (필요한 필드만 가져와 페이로드 최소화)
const feedPostSelect = {
  url: true,
  title: true,
  publishedAt: true,
  member: {
    select: {
      githubId: true,
      manualNickname: true,
      nicknameStats: true,
      nickname: true,
      avatarUrl: true,
      track: true,
      memberCohorts: {
        select: {
          cohort: { select: { number: true } },
          role: { select: { name: true } },
        },
      },
      submissions: {
        select: {
          status: true,
          missionRepo: { select: { track: true } },
        },
      },
    },
  },
} satisfies Prisma.BlogPostSelect;

export type FeedPost = Prisma.BlogPostGetPayload<{ select: typeof feedPostSelect }>;

// 2. 공통 Include 설정 (멤버, 기수, 트랙 정보 포함)
const blogPostWithMemberInclude = {
  member: {
    include: {
      memberCohorts: {
        include: {
          cohort: true,
          role: true,
        },
      },
      submissions: {
        select: {
          status: true,
          missionRepo: {
            select: { track: true },
          },
        },
      },
    },
  },
} satisfies Prisma.BlogPostInclude;

// 타입 정의
export type BlogPostWithMember = Prisma.BlogPostGetPayload<{
  include: typeof blogPostWithMemberInclude;
}>;

export function createBlogPostRepository(db: PrismaClient) {
  return {
    // [기본] 저장 및 업데이트 (30일치 데이터 관리용)
    upsert: (args: Prisma.BlogPostUpsertArgs) => db.blogPost.upsert(args),

    // [기본] 오래된 데이터 삭제 (30일 기준 청소용)
    deleteBefore: (date: Date) => db.blogPost.deleteMany({ where: { publishedAt: { lt: date } } }),

    // 특정 멤버의 모든 블로그 포스트 삭제 (블로그 URL 변경 시 사용)
    deleteByMember: (memberId: number) => db.blogPost.deleteMany({ where: { memberId } }),

    // RSS에서 사라진 글 삭제 (30일 이내 + 현재 피드에 없는 URL)
    deleteByMemberNotInUrls: (memberId: number, urls: string[], since: Date) =>
      db.blogPost.deleteMany({
        where: { memberId, publishedAt: { gte: since }, url: { notIn: urls } },
      }),

    findByMember: async (memberId: number, page?: number, perPage?: number, maxPosts = 100) => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const take = perPage ?? 10;
      const skip = page && page > 1 ? (page - 1) * take : 0;

      const allPosts = await db.blogPost.findMany({
        where: { memberId },
        orderBy: { publishedAt: 'desc' },
        take: maxPosts,
        select: { url: true, title: true, publishedAt: true },
      });

      const latest = allPosts.filter((post) => post.publishedAt >= sevenDaysAgo);
      const archive = allPosts.slice(skip, skip + take);
      const totalPages = Math.ceil(allPosts.length / take);

      return { archive, latest, page: page ?? 1, totalPages };
    },

    findFeed: async (
      workspaceId: number,
      filters?: {
        limit?: number;
        cohort?: number;
        track?: string;
        days?: number;
        role?: string;
        cursor?: string;
      },
    ) => {
      const days = filters?.days ?? 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const perMemberLimit = days <= 7 ? 3 : 5;
      const fetchLimit = filters?.limit ?? 50;

      const cursorDate = filters?.cursor ? new Date(filters.cursor) : null;
      const hasValidCursor = cursorDate !== null && !isNaN(cursorDate.getTime());

      const posts = await db.blogPost.findMany({
        where: {
          publishedAt: { gte: since },
          member: {
            workspaceId,
            ...(filters?.cohort ? { memberCohorts: { some: { cohort: { number: filters.cohort } } } } : {}),
            ...(filters?.role ? { memberCohorts: { some: { role: { name: filters.role } } } } : {}),
            ...(filters?.track
              ? {
                  OR: [
                    { track: filters.track },
                    {
                      track: null,
                      submissions: {
                        some: {
                          status: { not: 'closed' },
                          missionRepo: { track: filters.track },
                        },
                      },
                    },
                  ],
                }
              : {}),
          },
          ...(hasValidCursor ? { publishedAt: { lt: cursorDate } } : {}),
        },
        take: fetchLimit * 3,
        orderBy: { publishedAt: 'desc' },
        select: feedPostSelect,
      });

      const memberCount = new Map<string, number>();
      const filtered = posts.filter((post) => {
        const count = memberCount.get(post.member.githubId) ?? 0;
        if (count >= perMemberLimit) return false;
        memberCount.set(post.member.githubId, count + 1);
        return true;
      });

      const result = filtered.slice(0, fetchLimit);
      const lastPost = result[result.length - 1];
      const nextCursor = lastPost ? lastPost.publishedAt.toISOString() : null;

      return { posts: result, nextCursor };
    },

    findSince: (workspaceId: number, since: Date) =>
      db.blogPost.findMany({
        where: { createdAt: { gte: since }, member: { workspaceId } },
        orderBy: { publishedAt: 'desc' },
        include: blogPostWithMemberInclude,
      }),

    refreshLatest: async (_since: Date) => {
      return Promise.resolve();
    },

    deleteExcessByMember: async (memberId: number, maxCount: number) => {
      const excessPosts = await db.blogPost.findMany({
        where: { memberId },
        orderBy: { publishedAt: 'desc' },
        skip: maxCount,
        select: { id: true },
      });

      if (excessPosts.length === 0) return { count: 0 };

      return db.blogPost.deleteMany({
        where: { id: { in: excessPosts.map((p) => p.id) } },
      });
    },
  };
}

export type BlogPostRepository = ReturnType<typeof createBlogPostRepository>;
