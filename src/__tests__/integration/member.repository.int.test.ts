import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import prisma from '../../db/prisma.js';
import { createMemberRepository } from '../../db/repositories/member.repository.js';

// jest setupFiles가 테스트 파일마다 임시 SQLite를 붙인다 (실제 DB와 무관)
const repo = createMemberRepository(prisma);
let workspaceId: number;
let missionRepoId: number;

async function resetDb() {
  await prisma.blogPost.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.memberCohort.deleteMany();
  await prisma.previousGithubId.deleteMany();
  await prisma.member.deleteMany();
  await prisma.missionRepo.deleteMany();
  await prisma.workspace.deleteMany();
}

async function addMember(githubId: string, data: Record<string, unknown> = {}) {
  return repo.create({ githubId, workspaceId, ...data });
}

beforeEach(async () => {
  await resetDb();
  const workspace = await prisma.workspace.create({
    data: { name: 'woowacourse', githubOrg: 'woowacourse', cohortRules: '[]' },
  });
  workspaceId = workspace.id;
  const missionRepo = await prisma.missionRepo.create({
    data: { name: 'java-racingcar', repoUrl: 'https://github.com/woowacourse/java-racingcar', workspaceId },
  });
  missionRepoId = missionRepo.id;
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe('MemberRepository (SQLite)', () => {
  describe('lookups', () => {
    it('should find a member by GitHub id, user id, and id with relations', async () => {
      const created = await addMember('crew1', { githubUserId: 1001, nickname: '가람' });

      expect((await repo.findByGithubId('crew1', workspaceId))?.id).toBe(created.id);
      expect((await repo.findByGithubUserId(1001, workspaceId))?.id).toBe(created.id);
      expect((await repo.findPublicDetail('crew1', workspaceId))?.nickname).toBe('가람');
      const detail = await repo.findByIdWithRelations(created.id);
      expect(detail).toMatchObject({ memberCohorts: [], submissions: [], blogPosts: [] });
      expect(await repo.findByGithubId('nobody', workspaceId)).toBeNull();
    });

    it('should update and patch fields', async () => {
      const { id } = await addMember('crew1');

      const updated = await repo.update(id, { blog: 'https://b.example.com', track: 'backend' });
      await repo.patch(id, { manualNickname: '수동' });

      expect(updated).toMatchObject({ blog: 'https://b.example.com', track: 'backend' });
      expect((await repo.findByIdWithRelations(id))?.manualNickname).toBe('수동');
      expect(await repo.count()).toBe(1);
    });
  });

  describe('filters', () => {
    beforeEach(async () => {
      const a = await addMember('alpha', { nickname: '가', blog: 'https://a.example.com', track: 'backend' });
      const b = await addMember('beta', { nickname: '나' });
      const c = await addMember('gamma', { nickname: '다', manualNickname: '감마' });
      await addMember('team-blog', { isTeamBlog: true });
      await repo.upsertParticipation(a.id, 8, 'crew');
      await repo.upsertParticipation(b.id, 8, 'coach');
      await repo.upsertParticipation(c.id, 7, 'crew');
    });

    it('should exclude team blogs and order by nickname', async () => {
      const all = await repo.findWithFilters(workspaceId);
      expect(all.map((m) => m.githubId)).toEqual(['alpha', 'beta', 'gamma']);
      expect(await repo.countWithFilters(workspaceId)).toBe(3);
    });

    it('should filter by cohort, role group, role, blog, and track', async () => {
      const ids = async (filters: Parameters<typeof repo.findWithFiltersLight>[1]) =>
        (await repo.findWithFiltersLight(workspaceId, filters)).map((m) => m.githubId);

      expect(await ids({ cohort: 8 })).toEqual(['alpha', 'beta']);
      expect(await ids({ cohort: 8, roleGroup: 'crew' })).toEqual(['alpha']);
      expect(await ids({ roleGroup: 'staff' })).toEqual(['beta']);
      expect(await ids({ role: 'coa' })).toEqual(['beta']);
      expect(await ids({ hasBlog: true })).toEqual(['alpha']);
      expect(await ids({ hasBlog: false })).toEqual(['beta', 'gamma']);
      expect(await ids({ track: 'backend' })).toEqual(['alpha']);
    });

    it('should search by GitHub id, nickname, manual nickname, previous id, and name matches', async () => {
      const gamma = await repo.findByGithubId('gamma', workspaceId);
      await repo.replacePreviousGithubIds(gamma!.id, ['old-gamma']);
      const ids = async (q: string, nameMatchGithubIds?: string[]) =>
        (
          await repo.findWithFiltersLight(workspaceId, {
            q,
            ...(nameMatchGithubIds ? { nameMatchGithubIds } : {}),
          })
        ).map((m) => m.githubId);

      expect(await ids('alp')).toEqual(['alpha']);
      expect(await ids('나')).toEqual(['beta']);
      expect(await ids('감마')).toEqual(['gamma']);
      expect(await ids('old-gam')).toEqual(['gamma']);
      expect(await ids('zzz', ['beta'])).toEqual(['beta']);
    });

    it('should page results and count with the same filters', async () => {
      const page = await repo.findWithFiltersLightPage(workspaceId, undefined, { limit: 2, offset: 1 });
      expect(page.map((m) => m.githubId)).toEqual(['beta', 'gamma']);
      expect(await repo.countWithFilters(workspaceId, { roleGroup: 'crew' })).toBe(2);
    });

    it('should provide name search source and members by nickname', async () => {
      const source = await repo.findNameSearchSource(workspaceId);
      expect(source.map((m) => m.githubId).sort()).toEqual(['alpha', 'beta', 'gamma', 'team-blog']);

      expect((await repo.findManyByNickname('감마', workspaceId)).map((m) => m.githubId)).toEqual(['gamma']);
      expect((await repo.findManyByNickname('가', workspaceId)).map((m) => m.githubId)).toEqual(['alpha']);
    });

    it('should list distinct cohorts in descending order', async () => {
      expect(await repo.listMemberCohorts(workspaceId)).toEqual([8, 7]);
    });
  });

  describe('stale profiles', () => {
    it('should list profiles fetched before the threshold, oldest first, within limit and cohort', async () => {
      const a = await addMember('a', { profileFetchedAt: new Date('2026-01-01') });
      await addMember('b', { profileFetchedAt: new Date('2025-12-01') });
      await addMember('c', { profileFetchedAt: new Date('2026-10-01') });
      await repo.upsertParticipation(a.id, 8, 'crew');
      const staleBefore = new Date('2026-06-01');

      const stale = await repo.listStaleProfiles(workspaceId, { staleBefore, limit: 10 });
      const limited = await repo.listStaleProfiles(workspaceId, { staleBefore, limit: 1 });
      const cohort8 = await repo.listStaleProfiles(workspaceId, { staleBefore, cohort: 8, limit: 10 });

      expect(stale.map((m) => m.githubId)).toEqual(['b', 'a']);
      expect(limited.map((m) => m.githubId)).toEqual(['b']);
      expect(cohort8.map((m) => m.githubId)).toEqual(['a']);
    });
  });

  describe('upsert by GitHub user id', () => {
    it('should create then update identity fields while keeping the row', async () => {
      const created = await repo.upsert(workspaceId, 42, {
        githubId: 'first',
        githubUserId: 42,
        workspaceId,
        nickname: '처음',
        blog: 'https://first.example.com',
      });
      const updated = await repo.upsert(workspaceId, 42, { githubId: 'renamed', githubUserId: 42, workspaceId });

      expect(updated.id).toBe(created.id);
      expect(updated).toMatchObject({ githubId: 'renamed', nickname: null, blog: null, avatarUrl: null });
      expect(await repo.count()).toBe(1);
    });
  });

  describe('participations', () => {
    it('should upsert participations idempotently and delete by cohort', async () => {
      const { id } = await addMember('crew1');

      await repo.upsertParticipation(id, 8, 'crew');
      await repo.upsertParticipation(id, 8, 'crew');
      await repo.upsertParticipation(id, 8, 'reviewer');
      await repo.upsertParticipation(id, 7, 'crew');
      expect(await prisma.memberCohort.count({ where: { memberId: id } })).toBe(3);

      await repo.deleteParticipationsByCohort(id, 8);
      const remaining = await repo.findByIdWithRelations(id);
      expect(remaining!.memberCohorts.map((mc) => mc.cohort.number)).toEqual([7]);

      await expect(repo.deleteParticipationsByCohort(id, 99)).resolves.toBeUndefined();
    });
  });

  describe('previous GitHub ids', () => {
    // 이전 ID는 PreviousGithubId 테이블이 기준이고, replacePreviousGithubIds가 유일한 쓰기 경로다 (ARCHITECTURE_PLAN F-1)
    const tableIds = async (memberId: number) =>
      (await prisma.previousGithubId.findMany({ where: { memberId }, orderBy: { githubId: 'asc' } })).map(
        (r) => r.githubId,
      );

    it('should replace the list: add new ids and remove ids that are no longer listed', async () => {
      const { id } = await addMember('crew1');

      await repo.replacePreviousGithubIds(id, ['a', 'b']);
      expect(await tableIds(id)).toEqual(['a', 'b']);
      expect(await repo.findPreviousGithubIds(id)).toEqual(['a', 'b']);

      await repo.replacePreviousGithubIds(id, ['b', 'c']);
      expect(await tableIds(id)).toEqual(['b', 'c']);

      await repo.replacePreviousGithubIds(id, []);
      expect(await repo.findPreviousGithubIds(id)).toEqual([]);
    });

    it('should not touch previous ids from upsert, patch, or update', async () => {
      const created = await repo.upsert(workspaceId, 501, { githubId: 'renamed', githubUserId: 501, workspaceId });
      await repo.replacePreviousGithubIds(created.id, ['keep']);

      await repo.upsert(workspaceId, 501, { githubId: 'renamed-again', githubUserId: 501, workspaceId });
      await repo.patch(created.id, { nickname: '새닉' });
      await repo.update(created.id, { track: 'backend' });
      expect(await tableIds(created.id)).toEqual(['keep']);
    });
  });

  describe('deletion', () => {
    async function addActivity(memberId: number, n: number) {
      await prisma.submission.create({
        data: {
          prNumber: n,
          prUrl: `https://github.com/woowacourse/java-racingcar/pull/${n}`,
          title: `PR ${n}`,
          submittedAt: new Date(),
          memberId,
          missionRepoId,
        },
      });
      await prisma.blogPost.create({
        data: { url: `https://blog.example.com/${n}`, title: `글 ${n}`, publishedAt: new Date(), memberId },
      });
    }

    it('should delete a member with submissions and blog posts', async () => {
      const keep = await addMember('keep');
      const drop = await addMember('drop');
      await addActivity(keep.id, 1);
      await addActivity(drop.id, 2);

      await repo.deleteWithRelations(drop.id);

      expect(await repo.findByIdWithRelations(drop.id)).toBeNull();
      expect(await prisma.submission.count()).toBe(1);
      expect(await prisma.blogPost.count()).toBe(1);
    });

    it('should delete all members of the workspace with their activity', async () => {
      const a = await addMember('a');
      await addActivity(a.id, 3);
      await addMember('b');

      await repo.deleteAllWithRelations(workspaceId);

      expect(await repo.count()).toBe(0);
      expect(await prisma.submission.count()).toBe(0);
      expect(await prisma.blogPost.count()).toBe(0);
    });
  });
});
