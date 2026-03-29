import type { PrismaClient, Prisma } from '@prisma/client';

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
          missionRepo: {
            select: { track: true },
          },
        },
      },
    },
  },
};

export type BlogPostWithMember = Prisma.BlogPostLatestGetPayload<{
  include: typeof blogPostWithMemberInclude;
}>;

// ... 기존 include 설정 동일

export function createBlogPostRepository(db: PrismaClient) {
  return {
    findFeed: (workspaceId: number, filters?: { cohort?: number; track?: string; days?: number }) => {
      const days = filters?.days ?? 7;
      const since = new Date();
      since.setDate(since.getDate() - days);

      return db.blogPost.findMany({
        where: {
          publishedAt: { gte: since },
          member: {
            workspaceId,
            ...(filters?.cohort ? { memberCohorts: { some: { cohort: { number: filters.cohort } } } } : {}),
            ...(filters?.track ? { submissions: { some: { missionRepo: { track: filters.track } } } } : {}),
          },
        },
        orderBy: { publishedAt: 'desc' },
        include: blogPostWithMemberInclude,
      });
    },

    refreshLatest: async (since: Date) => {
      const recent = await db.blogPost.findMany({ where: { publishedAt: { gte: since } } });
      await db.blogPostLatest.deleteMany({});
      if (recent.length === 0) return;
      await db.blogPostLatest.createMany({
        data: recent.map(({ url, title, publishedAt, memberId }) => ({ url, title, publishedAt, memberId })),
      });
    },
  };
}

export type BlogPostRepository = ReturnType<typeof createBlogPostRepository>;
