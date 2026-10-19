import { jest, describe, it, expect, beforeEach, afterAll } from '@jest/globals';

// 레포 싱크가 DB에 남기는 결과를 실제 SQLite로 고정한다 (ARCHITECTURE_PLAN의 "동작 고정 테스트").
// GitHub·RSS만 가짜로 바꾸고 저장소는 진짜를 쓴다. 쓰기 경로를 바꾸는 리팩토링 전·후 같은 스냅샷이어야 한다
const fetchRepoPRs = jest.fn();
const fetchUserBlogCandidates = jest.fn();
const probeRss = jest.fn();

jest.unstable_mockModule('../../infra/github/github.client.js', () => ({
  fetchRepoPRs,
  fetchUserBlogCandidates,
  detectCohort: (date: Date, rules: { year: number; cohort: number }[]) =>
    rules.find((r) => r.year === date.getFullYear())?.cohort ?? null,
}));
jest.unstable_mockModule('../../infra/rss/rss.js', () => ({ probeRss }));

const { default: prisma } = await import('../../db/prisma.js');
const { createRepoSyncer } = await import('../../features/sync/sync.repo-sync.js');
const { createMemberRepository } = await import('../../db/repositories/member.repository.js');
const { createMissionRepoRepository } = await import('../../db/repositories/mission-repo.repository.js');
const { createSubmissionRepository } = await import('../../db/repositories/submission.repository.js');
const { createBannedWordRepository } = await import('../../db/repositories/banned-word.repository.js');
const { createIgnoredDomainRepository } = await import('../../db/repositories/ignored-domain.repository.js');
const syncWrite = await import('../../db/repositories/sync-write.repository.js').catch(() => null);

const RULES = [
  { year: 2026, cohort: 8 },
  { year: 2025, cohort: 7 },
];

function pr(number: number, login: string, userId: number, title: string, createdAt: string, state = 'closed') {
  return {
    number,
    html_url: `https://github.com/woowacourse/java-racingcar/pull/${number}`,
    title,
    state,
    merged_at: state === 'closed' ? createdAt : null,
    user: { login, id: userId },
    base: { ref: login },
    created_at: createdAt,
  };
}

// 옛 구조(memberRepo·submissionRepo)와 새 구조(syncWriteRepo)에 모두 넘긴다 — 쓰지 않는 쪽은 무시된다
function makeSyncer() {
  return createRepoSyncer({
    memberRepo: createMemberRepository(prisma),
    missionRepoRepo: createMissionRepoRepository(prisma),
    submissionRepo: createSubmissionRepository(prisma),
    bannedWordRepo: createBannedWordRepository(prisma),
    ignoredDomainRepo: createIgnoredDomainRepository(prisma),
    ...(syncWrite ? { syncWriteRepo: syncWrite.createSyncWriteRepository(prisma) } : {}),
  } as never);
}

async function resetDb() {
  await prisma.submission.deleteMany();
  await prisma.memberCohort.deleteMany();
  await prisma.previousGithubId.deleteMany();
  await prisma.blogPost.deleteMany();
  await prisma.member.deleteMany();
  await prisma.missionRepo.deleteMany();
  await prisma.nicknameBannedWord.deleteMany();
  await prisma.workspace.deleteMany();
}

// 비교용 행: 시각(profileFetchedAt)은 있는지만, 관계는 이름으로
async function snapshotRows() {
  const members = await prisma.member.findMany({
    orderBy: { githubUserId: 'asc' },
    include: {
      previousIds: { orderBy: { githubId: 'asc' } },
      memberCohorts: { include: { cohort: true, role: true } },
      submissions: { orderBy: { prNumber: 'asc' }, include: { missionRepo: true } },
    },
  });
  return members.map((m) => ({
    githubId: m.githubId,
    githubUserId: m.githubUserId,
    nickname: m.nickname,
    nicknameStats: m.nicknameStats ? JSON.parse(m.nicknameStats) : null,
    avatarUrl: m.avatarUrl,
    blog: m.blog,
    profileFetched: m.profileFetchedAt !== null,
    profileRefreshError: m.profileRefreshError,
    previousIds: m.previousIds.map((p) => p.githubId),
    cohorts: m.memberCohorts.map((c) => `${c.cohort.number}:${c.role.name}`).sort(),
    submissions: m.submissions.map((s) => ({
      prNumber: s.prNumber,
      repo: s.missionRepo.name,
      title: s.title,
      status: s.status,
      submittedAt: s.submittedAt.toISOString(),
    })),
  }));
}

let workspaceId: number;
let baseRepo: { id: number; name: string; track: string | null; lastSyncAt: Date | null };
let commonRepo: { id: number; name: string; track: string | null; lastSyncAt: Date | null };

beforeEach(async () => {
  await resetDb();
  fetchRepoPRs.mockReset();
  fetchUserBlogCandidates.mockReset();
  probeRss.mockReset();
  const ws = await prisma.workspace.create({
    data: { name: 'woowacourse', githubOrg: 'woowacourse', cohortRules: JSON.stringify(RULES) },
  });
  workspaceId = ws.id;
  await prisma.nicknameBannedWord.create({ data: { word: '미션', workspaceId } });
  const base = await prisma.missionRepo.create({
    data: { name: 'java-racingcar', repoUrl: 'u1', track: 'backend', workspaceId },
  });
  const common = await prisma.missionRepo.create({
    data: { name: 'java-common', repoUrl: 'u2', track: null, workspaceId },
  });
  baseRepo = { id: base.id, name: base.name, track: base.track, lastSyncAt: null };
  commonRepo = { id: common.id, name: common.name, track: common.track, lastSyncAt: null };

  fetchUserBlogCandidates.mockImplementation(
    async (_o: unknown, input: { username?: string; githubUserId?: number | null }) => ({
      profile: {
        githubUserId: input.githubUserId ?? null,
        githubId: input.username === 'old-login' ? 'new-login' : (input.username ?? 'unknown'),
        avatarUrl: `https://avatars/${input.githubUserId}`,
        blog: null,
      },
      candidates: input.username === 'nocandidate' ? [] : [`https://velog.io/@${input.username}`],
    }),
  );
  probeRss.mockImplementation(async (url: string) => ({ status: url.includes('dead') ? 'unavailable' : 'available' }));
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe('repo sync writes (SQLite)', () => {
  it('should create members, cohorts, previous ids and submissions exactly as before', async () => {
    // 이미 있는 멤버: 깃허브 아이디를 바꿨다 (old-login → new-login, 같은 user id)
    await prisma.member.create({
      data: { githubId: 'old-login', githubUserId: 3003, nickname: '네오', workspaceId },
    });

    fetchRepoPRs.mockResolvedValueOnce([
      pr(1, 'crew1', 1001, '[1단계 - 자동차 경주] 콘티 미션 제출합니다.', '2026-03-02T00:00:00Z'),
      pr(2, 'crew1', 1001, '[2단계] 콘티 리뷰 요청', '2026-03-09T00:00:00Z', 'open'),
      pr(3, 'crew2', 2002, '[1단계] 가람 제출', '2025-03-05T00:00:00Z'),
      pr(4, 'old-login', 3003, '[1단계] 네오 제출', '2026-03-03T00:00:00Z'),
      pr(5, 'nocandidate', 4004, '[1단계] 블로그없음 제출', '2026-03-04T00:00:00Z'),
    ]);
    const syncer = makeSyncer();
    const first = await syncer.syncRepo({} as never, workspaceId, 'woowacourse', baseRepo, RULES);

    // 공통 미션: 모르는 사람(crew9)은 건너뛰고 아는 사람만 연결
    fetchRepoPRs.mockResolvedValueOnce([
      pr(10, 'crew1', 1001, '[공통] 콘티 제출', '2026-04-01T00:00:00Z'),
      pr(11, 'crew9', 9009, '[공통] 모르는사람 제출', '2026-04-01T00:00:00Z'),
    ]);
    const second = await syncer.syncRepo({} as never, workspaceId, 'woowacourse', commonRepo, RULES);

    expect({ first, second }).toMatchSnapshot('results');
    expect(await snapshotRows()).toMatchSnapshot('rows');
  });

  it('should keep the existing blog and avatar for deleted (ghost) accounts', async () => {
    await prisma.member.create({
      data: {
        githubId: 'crew1',
        githubUserId: 1001,
        blog: 'https://kept.blog',
        avatarUrl: 'https://kept.avatar',
        workspaceId,
      },
    });
    fetchUserBlogCandidates.mockResolvedValueOnce({
      profile: { githubUserId: 1001, githubId: 'ghost', avatarUrl: null, blog: null },
      candidates: [],
    });
    fetchRepoPRs.mockResolvedValueOnce([pr(7, 'crew1', 1001, '[1단계] 콘티', '2026-03-02T00:00:00Z')]);

    await makeSyncer().syncRepo({} as never, workspaceId, 'woowacourse', baseRepo, RULES);

    expect(await snapshotRows()).toMatchSnapshot('ghost rows');
  });

  it('should keep the database unchanged for a PR whose submission write fails', async () => {
    if (!syncWrite) return; // 트랜잭션은 새 쓰기 경로에만 있다
    await prisma.member.create({ data: { githubId: 'crew1', githubUserId: 1001, nickname: '예전', workspaceId } });
    // PR URL이 비어 제출 저장만 실패한다 (멤버 upsert·기수 참여는 그 앞에서 이미 실행된 상태)
    fetchRepoPRs.mockResolvedValueOnce([
      { ...pr(1, 'crew1', 1001, '[1단계] 새닉네임 제출', '2026-03-02T00:00:00Z'), html_url: undefined },
    ]);

    const result = await makeSyncer().syncRepo({} as never, workspaceId, 'woowacourse', baseRepo, RULES);

    expect(result.synced).toBe(0);
    expect(result.failures).toHaveLength(1);
    const member = await prisma.member.findUniqueOrThrow({
      where: { githubId_workspaceId: { githubId: 'crew1', workspaceId } },
    });
    expect(member.nickname).toBe('예전'); // 멤버 갱신도 함께 되돌려졌다
    expect(member.nicknameStats).toBeNull();
    expect(await prisma.memberCohort.count()).toBe(0);
  });

  it('should keep query count per pull request small', async () => {
    const { PrismaClient } = await import('@prisma/client');
    const counted = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
    let queries = 0;
    counted.$on('query', () => {
      queries++;
    });
    // 프로필이 최신인 기존 멤버 5명 → GitHub 호출 없이 DB 쓰기만
    for (let i = 1; i <= 5; i++) {
      await prisma.member.create({
        data: {
          githubId: `crew${i}`,
          githubUserId: 1000 + i,
          blog: 'https://b',
          avatarUrl: 'https://a',
          profileFetchedAt: new Date(),
          workspaceId,
        },
      });
    }
    fetchRepoPRs.mockResolvedValueOnce(
      Array.from({ length: 5 }, (_, i) => pr(i + 1, `crew${i + 1}`, 1001 + i, '[1단계] 제출', '2026-03-02T00:00:00Z')),
    );
    const syncer = createRepoSyncer({
      memberRepo: createMemberRepository(counted),
      submissionRepo: createSubmissionRepository(counted),
      missionRepoRepo: createMissionRepoRepository(counted),
      bannedWordRepo: createBannedWordRepository(counted),
      ignoredDomainRepo: createIgnoredDomainRepository(counted),
      ...(syncWrite ? { syncWriteRepo: syncWrite.createSyncWriteRepository(counted) } : {}),
    } as never);

    await syncer.syncRepo({} as never, workspaceId, 'woowacourse', baseRepo, RULES);
    await counted.$disconnect();

    // 2026-10-20 측정: 예전 쓰기 경로 153개(PR당 약 31 — 상세 include 조회·upsert 반환), 지금 59개(약 12).
    // 조회 2 + 트랜잭션(BEGIN·멤버 upsert·이전 아이디·참여·제출·COMMIT), 기수·역할 upsert는 첫 건만
    expect(queries).toBeLessThanOrEqual(60);
  });
});
