import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import prisma from '../../db/prisma.js';
import { createCohortRepoRepository } from '../../db/repositories/cohort-repo.repository.js';
import { createPersonRepository } from '../../db/repositories/person.repository.js';

// jest setupFiles가 테스트 파일마다 임시 SQLite를 붙인다 (실제 DB와 무관)
const cohortRepos = createCohortRepoRepository(prisma);
const persons = createPersonRepository(prisma);
let workspaceId: number;

async function resetDb() {
  await prisma.cohortRepo.deleteMany();
  await prisma.memberCohort.deleteMany();
  await prisma.member.deleteMany();
  await prisma.person.deleteMany();
  await prisma.missionRepo.deleteMany();
  await prisma.workspace.deleteMany();
}

async function addMissionRepo(name: string) {
  return prisma.missionRepo.create({
    data: { name, repoUrl: `https://github.com/woowacourse/${name}`, workspaceId, track: 'backend' },
  });
}

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

describe('CohortRepoRepository (SQLite)', () => {
  it('should create, order, update, and delete cohort repos', async () => {
    const racing = await addMissionRepo('java-racingcar');
    const lotto = await addMissionRepo('java-lotto');

    const second = await cohortRepos.create({ cohort: 8, order: 2, missionRepoId: lotto.id, workspaceId });
    await cohortRepos.create({ cohort: 8, order: 1, missionRepoId: racing.id, workspaceId, level: 1 });

    expect(second.missionRepo).toMatchObject({ name: 'java-lotto', track: 'backend', tabCategory: 'base' });
    expect((await cohortRepos.findByCohort(workspaceId, 8)).map((r) => r.missionRepo.name)).toEqual([
      'java-racingcar',
      'java-lotto',
    ]);

    const updated = await cohortRepos.update(second.id, { order: 0, level: null });
    expect(updated).toMatchObject({ order: 0, level: null });
    expect((await cohortRepos.findByCohort(workspaceId, 8))[0]!.missionRepo.name).toBe('java-lotto');

    await cohortRepos.delete(second.id);
    expect(await cohortRepos.findById(second.id)).toBeNull();
    expect((await cohortRepos.findExistingIds(workspaceId, 8)).map((r) => r.missionRepoId)).toEqual([racing.id]);
  });

  it('should create many rows atomically and list distinct cohorts', async () => {
    const a = await addMissionRepo('a');
    const b = await addMissionRepo('b');

    await cohortRepos.createMany([
      { cohort: 7, order: 0, missionRepoId: a.id, workspaceId },
      { cohort: 8, order: 0, missionRepoId: a.id, workspaceId },
      { cohort: 8, order: 1, missionRepoId: b.id, workspaceId, level: 2 },
    ]);

    expect((await cohortRepos.listCohorts(workspaceId)).map((r) => r.cohort)).toEqual([8, 7]);
    await expect(
      cohortRepos.createMany([
        { cohort: 6, order: 0, missionRepoId: a.id, workspaceId },
        { cohort: 8, order: 0, missionRepoId: a.id, workspaceId }, // (cohort, missionRepoId) 중복
      ]),
    ).rejects.toThrow();
    expect((await cohortRepos.listCohorts(workspaceId)).map((r) => r.cohort)).toEqual([8, 7]);
  });
});

describe('PersonRepository (SQLite)', () => {
  async function addMember(githubId: string) {
    return prisma.member.create({ data: { githubId, workspaceId } });
  }

  it('should create, update, list, link, and unlink members', async () => {
    const first = await persons.create(workspaceId, { displayName: '가람' });
    const second = await persons.create(workspaceId, {});
    const m1 = await addMember('garam');
    const m2 = await addMember('garam-old');

    await persons.linkMember(first.id, m1.id);
    await persons.linkMember(first.id, m2.id);
    const updated = await persons.update(first.id, { note: '동일인', displayName: null });

    expect(updated).toMatchObject({ displayName: null, note: '동일인' });
    expect(updated.members.map((m) => m.githubId).sort()).toEqual(['garam', 'garam-old']);
    expect((await persons.findAll(workspaceId)).map((p) => p.id).sort()).toEqual([first.id, second.id].sort());

    await persons.unlinkMember(m2.id);
    expect((await persons.findById(first.id))!.members.map((m) => m.githubId)).toEqual(['garam']);
  });

  it('should unlink members before deleting a person', async () => {
    const person = await persons.create(workspaceId, { displayName: 'x' });
    const member = await addMember('crew1');
    await persons.linkMember(person.id, member.id);

    await persons.delete(person.id);

    expect(await persons.findById(person.id)).toBeNull();
    expect((await prisma.member.findUnique({ where: { id: member.id } }))!.personId).toBeNull();
  });
});
