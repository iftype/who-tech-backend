import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import prisma from '../../db/prisma.js';
import { createBlogPostRepository } from '../../db/repositories/blog-post.repository.js';
import { createMemberRepository } from '../../db/repositories/member.repository.js';

// jest setupFiles가 테스트 파일마다 임시 SQLite를 붙인다 (실제 DB와 무관)
const repo = createBlogPostRepository(prisma);
const memberRepo = createMemberRepository(prisma);
let workspaceId: number;

async function resetDb() {
  await prisma.blogPost.deleteMany();
  await prisma.memberCohort.deleteMany();
  await prisma.member.deleteMany();
  await prisma.workspace.deleteMany();
}

async function addMember(githubId: string, data: Record<string, unknown> = {}) {
  return memberRepo.create({ githubId, workspaceId, ...data });
}

let seq = 0;
async function addPost(memberId: number, publishedAt: string, data: Record<string, unknown> = {}) {
  seq += 1;
  return prisma.blogPost.create({
    data: {
      url: `https://blog.example.com/${seq}`,
      title: `글 ${seq}`,
      publishedAt: new Date(publishedAt),
      memberId,
      workspaceId,
      ...data,
    },
  });
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

beforeEach(async () => {
  await resetDb();
  const workspace = await prisma.workspace.create({
    data: { name: 'woowacourse', githubOrg: 'woowacourse', cohortRules: '[]' },
  });
  workspaceId = workspace.id;
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe('BlogPostRepository (SQLite)', () => {
  describe('upsert / view count', () => {
    it('should upsert by URL and count visits', async () => {
      const { id: memberId } = await addMember('crew1');
      const args = {
        where: { url: 'https://b.example.com/1' },
        create: { url: 'https://b.example.com/1', title: '처음', publishedAt: new Date(), memberId },
        update: { title: '수정' },
      };

      const created = await repo.upsert(args);
      const updated = await repo.upsert(args);

      expect(updated.id).toBe(created.id);
      expect(updated.title).toBe('수정');
      expect(await repo.incrementViewCount(created.id)).toEqual({ url: 'https://b.example.com/1', viewCount: 1 });
      expect(await repo.incrementViewCount(created.id)).toEqual({ url: 'https://b.example.com/1', viewCount: 2 });
      expect(await repo.incrementViewCount(99999)).toBeNull();
    });
  });

  describe('deletion helpers', () => {
    it('should delete posts before a date, by member, and those missing from the feed', async () => {
      const a = await addMember('a');
      const b = await addMember('b');
      const old = await addPost(a.id, '2025-01-01');
      const kept = await addPost(a.id, daysAgo(1));
      const gone = await addPost(a.id, daysAgo(2));
      await addPost(b.id, daysAgo(1));

      await repo.deleteBefore(new Date('2025-06-01'));
      expect(await prisma.blogPost.findUnique({ where: { id: old.id } })).toBeNull();

      await repo.deleteByMemberNotInUrls(a.id, [kept.url], new Date(daysAgo(30)));
      expect(await prisma.blogPost.findUnique({ where: { id: gone.id } })).toBeNull();
      expect(await prisma.blogPost.findUnique({ where: { id: kept.id } })).not.toBeNull();

      await repo.deleteByMember(b.id);
      expect(await prisma.blogPost.count({ where: { memberId: b.id } })).toBe(0);
      expect(await prisma.blogPost.count()).toBe(1);
    });

    it('should keep only the newest posts per member', async () => {
      const { id } = await addMember('a');
      for (const d of ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']) await addPost(id, d);

      expect(await repo.deleteExcessByMember(id, 5)).toEqual({ count: 0 });
      expect(await repo.deleteExcessByMember(id, 2)).toEqual({ count: 2 });

      const left = await prisma.blogPost.findMany({ where: { memberId: id }, orderBy: { publishedAt: 'asc' } });
      expect(left.map((p) => p.publishedAt.toISOString().slice(0, 10))).toEqual(['2026-01-03', '2026-01-04']);
    });

    it('should keep at most N posts per day per member', async () => {
      const { id } = await addMember('a');
      await addPost(id, '2026-03-01T01:00:00Z');
      await addPost(id, '2026-03-01T02:00:00Z');
      await addPost(id, '2026-03-01T03:00:00Z');
      await addPost(id, '2026-03-02T01:00:00Z');

      expect(await repo.deleteExcessPerDayByMember(id, 3)).toEqual({ count: 0 });
      expect(await repo.deleteExcessPerDayByMember(id, 2)).toEqual({ count: 1 });

      const counts = await repo.countPostsByDaySince(id, new Date('2026-02-01'));
      expect(Object.fromEntries(counts)).toEqual({ '2026-03-01': 2, '2026-03-02': 1 });
    });
  });

  describe('findByMember', () => {
    it('should page the archive and list posts from the last 7 days', async () => {
      const { id } = await addMember('a');
      await addPost(id, daysAgo(1));
      await addPost(id, daysAgo(3));
      await addPost(id, daysAgo(20));
      await addPost(id, daysAgo(40));

      const first = await repo.findByMember(id, undefined, 3);
      const second = await repo.findByMember(id, 2, 3);
      const capped = await repo.findByMember(id, 1, 10, 2);

      expect(first.archive).toHaveLength(3);
      expect(first).toMatchObject({ page: 1, totalPages: 2 });
      expect(first.latest).toHaveLength(2);
      expect(second.archive).toHaveLength(1);
      expect(second.page).toBe(2);
      expect(capped.archive).toHaveLength(2);
      expect(capped.totalPages).toBe(1);
    });
  });

  describe('findFeed', () => {
    it('should filter by days, cohort, and track (including members without a track)', async () => {
      const backend = await addMember('backend', { track: 'backend' });
      const frontend = await addMember('frontend', { track: 'frontend' });
      const unknown = await addMember('unknown');
      await memberRepo.upsertParticipation(backend.id, 8, 'crew');
      await memberRepo.upsertParticipation(frontend.id, 7, 'crew');
      await addPost(backend.id, daysAgo(1));
      await addPost(frontend.id, daysAgo(2));
      await addPost(unknown.id, daysAgo(3));
      await addPost(backend.id, daysAgo(60));

      const authors = async (filters: Parameters<typeof repo.findFeed>[1]) =>
        (await repo.findFeed(workspaceId, filters)).posts.map((p) => p.member.githubId);

      expect(await authors({})).toEqual(['backend', 'frontend', 'unknown', 'backend']);
      expect(await authors({ days: 30 })).toEqual(['backend', 'frontend', 'unknown']);
      expect(await authors({ cohort: 8 })).toEqual(['backend', 'backend']);
      expect(await authors({ track: 'frontend', days: 30 })).toEqual(['frontend', 'unknown']);
      expect((await repo.findFeed(workspaceId, { days: 30 })).totalCount).toBe(3);
    });

    it('should paginate with a cursor without duplicates or gaps', async () => {
      const { id } = await addMember('a');
      for (let i = 1; i <= 5; i++) await addPost(id, `2026-05-0${i}T00:00:00Z`);

      const seen: number[] = [];
      let cursor: string | undefined;
      for (let guard = 0; guard < 5; guard++) {
        const page = await repo.findFeed(workspaceId, { limit: 2, ...(cursor ? { cursor } : {}) });
        seen.push(...page.posts.map((p) => p.id));
        if (page.posts.length < 2) break;
        cursor = page.nextCursor ?? undefined;
      }

      expect(seen).toHaveLength(5);
      expect(new Set(seen).size).toBe(5);
    });

    // 정렬은 publishedAt만 지정되어 있고 동률은 커서의 id 조건에 기댄다 → 같은 시각 글도 중복·누락이 없어야 한다
    it('should paginate posts with identical timestamps without duplicates', async () => {
      const { id } = await addMember('a');
      for (let i = 0; i < 5; i++) await addPost(id, '2026-05-01T00:00:00Z');

      const seen: number[] = [];
      let cursor: string | undefined;
      for (let guard = 0; guard < 6; guard++) {
        const page = await repo.findFeed(workspaceId, { limit: 2, ...(cursor ? { cursor } : {}) });
        seen.push(...page.posts.map((p) => p.id));
        if (page.posts.length < 2) break;
        cursor = page.nextCursor ?? undefined;
      }

      expect(seen).toHaveLength(5);
      expect(new Set(seen).size).toBe(5);
    });

    it('should ignore an invalid cursor and return a null cursor for an empty feed', async () => {
      const { id } = await addMember('a');
      await addPost(id, daysAgo(1));

      expect((await repo.findFeed(workspaceId, { cursor: 'not-a-date|1' })).posts).toHaveLength(1);
      const empty = await repo.findFeed(workspaceId, { days: 0 });
      expect(empty).toEqual({ posts: [], nextCursor: null, totalCount: 0 });
    });
  });

  describe('findSince / refreshLatest', () => {
    it('should return recent posts of the workspace with member relations', async () => {
      const { id } = await addMember('a');
      await addPost(id, daysAgo(1));
      await addPost(id, daysAgo(10));

      const posts = await repo.findSince(workspaceId, new Date(daysAgo(5)));

      expect(posts).toHaveLength(1);
      expect(posts[0]!.member.githubId).toBe('a');
      await expect(repo.refreshLatest(new Date())).resolves.toBeUndefined();
    });
  });
});
