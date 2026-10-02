import type { PrismaClient, Prisma } from '@prisma/client';

export function createTeamBlogRepository(db: PrismaClient) {
  return {
    findAll: (workspaceId: number) => db.teamBlog.findMany({ where: { workspaceId }, orderBy: { name: 'asc' } }),
    findBySlug: (workspaceId: number, slug: string) =>
      db.teamBlog.findUnique({ where: { slug_workspaceId: { slug, workspaceId } } }),
    create: (data: Prisma.TeamBlogUncheckedCreateInput) => db.teamBlog.create({ data }),
    update: (id: number, data: Prisma.TeamBlogUncheckedUpdateInput) => db.teamBlog.update({ where: { id }, data }),
  };
}

export type TeamBlogRepository = ReturnType<typeof createTeamBlogRepository>;
