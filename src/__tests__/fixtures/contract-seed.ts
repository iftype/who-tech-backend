import type { PrismaClient } from '@prisma/client';

// API 계약 테스트와 어드민 스크린샷 테스트가 함께 쓰는 고정 데이터 (ARCHITECTURE_PLAN A-2·A-3).
// 실제 사람이 아닌 합성 데이터이고, 날짜는 모두 고정값이라 응답이 매번 같다.
// 빈 DB에 한 번만 넣는다고 가정한다 (autoincrement id가 생성 순서대로 정해짐)

export const SEED_NOW = new Date('2026-10-01T09:00:00.000Z');

const at = (iso: string) => new Date(iso);

export async function seedContractData(prisma: PrismaClient) {
  const workspace = await prisma.workspace.create({
    data: {
      name: 'woowacourse',
      githubOrg: 'woowacourse',
      cohortRules: JSON.stringify([
        { year: 2026, cohort: 8 },
        { year: 2025, cohort: 7 },
        { year: 2024, cohort: 6 },
      ]),
      lastProfileRefreshAt: at('2026-09-30T03:00:00.000Z'),
      createdAt: at('2026-01-01T00:00:00.000Z'),
      updatedAt: at('2026-09-30T03:00:00.000Z'),
    },
  });
  const workspaceId = workspace.id;

  const c6 = await prisma.cohort.create({ data: { number: 6, description: '6기' } });
  const c7 = await prisma.cohort.create({ data: { number: 7, description: '7기' } });
  const c8 = await prisma.cohort.create({ data: { number: 8, description: '8기' } });
  const crew = await prisma.role.create({ data: { name: 'crew' } });
  const coach = await prisma.role.create({ data: { name: 'coach' } });
  const reviewer = await prisma.role.create({ data: { name: 'reviewer' } });

  const person = await prisma.person.create({
    data: { displayName: '동일인', note: '계정 두 개', workspaceId, createdAt: at('2026-02-01T00:00:00.000Z') },
  });

  const memberDefaults = {
    workspaceId,
    createdAt: at('2026-03-01T00:00:00.000Z'),
    updatedAt: at('2026-09-30T03:00:00.000Z'),
    profileFetchedAt: at('2026-09-30T03:00:00.000Z'),
  };

  // 프론트 8기 크루: 블로그 RSS 사용, 이전 GitHub ID 있음, 같은 사람의 다른 계정과 연결
  const fe8 = await prisma.member.create({
    data: {
      ...memberDefaults,
      githubUserId: 1001,
      githubId: 'fe-crew',
      nickname: '하루',
      nicknameStats: JSON.stringify([
        { nickname: '하루', count: 3, lastSeenAt: '2026-03-12T10:00:00.000Z' },
        { nickname: '로또', count: 2, lastSeenAt: '2026-03-12T10:00:00.000Z' },
      ]),
      avatarUrl: 'https://avatars.githubusercontent.com/u/1001?v=4',
      blog: 'https://haru.example.com',
      rssStatus: 'available',
      rssUrl: 'https://haru.example.com/rss',
      rssCheckedAt: at('2026-09-30T04:00:00.000Z'),
      lastPostedAt: at('2026-09-29T12:00:00.000Z'),
      track: 'frontend',
      personId: person.id,
      memberCohorts: { create: [{ cohortId: c8.id, roleId: crew.id }] },
      previousIds: { create: [{ githubId: 'fe-crew-old' }] },
    },
  });

  // 백엔드 7기 크루: 관리자가 닉네임을 직접 지정, 기수 고정, RSS 실패
  const be7 = await prisma.member.create({
    data: {
      ...memberDefaults,
      githubUserId: 1002,
      githubId: 'be-crew',
      nickname: '자동닉',
      manualNickname: '바다',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1002?v=4',
      blog: 'https://bada.example.com',
      rssStatus: 'error',
      rssError: 'timeout',
      rssCheckedAt: at('2026-09-30T04:00:00.000Z'),
      track: 'backend',
      cohortLocked: true,
      memberCohorts: { create: [{ cohortId: c7.id, roleId: crew.id }] },
    },
  });

  // 같은 사람의 두 번째 계정 (6기 안드로이드)
  const an6 = await prisma.member.create({
    data: {
      ...memberDefaults,
      githubUserId: 1003,
      githubId: 'android-crew',
      nickname: '하루',
      track: 'android',
      rssStatus: 'unavailable',
      personId: person.id,
      memberCohorts: { create: [{ cohortId: c6.id, roleId: crew.id }] },
    },
  });

  // 코치(여러 기수) / 리뷰어
  const coachMember = await prisma.member.create({
    data: {
      ...memberDefaults,
      githubUserId: 1004,
      githubId: 'coach-a',
      nickname: '구름',
      rssStatus: 'unknown',
      memberCohorts: {
        create: [
          { cohortId: c7.id, roleId: coach.id },
          { cohortId: c8.id, roleId: coach.id },
        ],
      },
    },
  });
  await prisma.member.create({
    data: {
      ...memberDefaults,
      githubUserId: 1005,
      githubId: 'reviewer-a',
      nickname: '별',
      rssStatus: 'unknown',
      memberCohorts: { create: [{ cohortId: c8.id, roleId: reviewer.id }] },
    },
  });

  // 팀 블로그 (멤버 + TeamBlog)
  const teamMember = await prisma.member.create({
    data: {
      ...memberDefaults,
      githubId: 'team-blog-a',
      nickname: '우리팀',
      blog: 'https://team.example.com',
      rssStatus: 'available',
      rssUrl: 'https://team.example.com/rss',
      lastPostedAt: at('2026-09-28T08:00:00.000Z'),
      isTeamBlog: true,
    },
  });
  await prisma.teamBlog.create({
    data: {
      slug: 'team-a',
      name: '우리팀 블로그',
      blogUrl: 'https://team.example.com',
      rssUrl: 'https://team.example.com/rss',
      rssStatus: 'available',
      rssCheckedAt: at('2026-09-30T04:00:00.000Z'),
      lastPostedAt: at('2026-09-28T08:00:00.000Z'),
      memberId: teamMember.id,
      workspaceId,
      createdAt: at('2026-02-01T00:00:00.000Z'),
      updatedAt: at('2026-09-30T04:00:00.000Z'),
    },
  });

  const repoDefaults = { workspaceId, lastSyncAt: at('2026-09-30T05:00:00.000Z') };
  const lotto = await prisma.missionRepo.create({
    data: {
      ...repoDefaults,
      githubRepoId: 501,
      name: 'javascript-lotto',
      repoUrl: 'https://github.com/woowacourse/javascript-lotto',
      description: '로또',
      track: 'frontend',
      type: 'individual',
      tabCategory: 'base',
      status: 'active',
      syncMode: 'continuous',
    },
  });
  const racing = await prisma.missionRepo.create({
    data: {
      ...repoDefaults,
      githubRepoId: 502,
      name: 'java-racingcar',
      repoUrl: 'https://github.com/woowacourse/java-racingcar',
      track: 'backend',
      tabCategory: 'base',
      status: 'active',
      syncMode: 'once',
      // MissionRepo.cohorts(JSON)를 읽는 cohort-repos auto-fill 동작을 고정하기 위한 값 (ARCHITECTURE_PLAN F-2)
      cohorts: JSON.stringify([7, 8]),
    },
  });
  await prisma.missionRepo.create({
    data: {
      ...repoDefaults,
      githubRepoId: 503,
      name: 'woowa-precourse',
      repoUrl: 'https://github.com/woowacourse/woowa-precourse',
      tabCategory: 'precourse',
      status: 'candidate',
      candidateReason: '이름 패턴 일치',
      lastSyncAt: null,
    },
  });

  await prisma.cohortRepo.create({ data: { cohort: 8, order: 1, level: 1, missionRepoId: lotto.id, workspaceId } });
  await prisma.cohortRepo.create({ data: { cohort: 7, order: 1, level: 1, missionRepoId: racing.id, workspaceId } });

  const submissions = [
    {
      prNumber: 11,
      prUrl: 'https://github.com/woowacourse/javascript-lotto/pull/11',
      title: '[1단계 - 로또] 하루 미션 제출합니다.',
      status: 'merged',
      submittedAt: at('2026-03-05T10:00:00.000Z'),
      memberId: fe8.id,
      missionRepoId: lotto.id,
    },
    {
      prNumber: 12,
      prUrl: 'https://github.com/woowacourse/javascript-lotto/pull/12',
      title: '[2단계 - 로또] 하루 미션 제출합니다.',
      status: 'open',
      submittedAt: at('2026-03-12T10:00:00.000Z'),
      memberId: fe8.id,
      missionRepoId: lotto.id,
    },
    {
      prNumber: 21,
      prUrl: 'https://github.com/woowacourse/java-racingcar/pull/21',
      title: '[1단계 - 자동차 경주] 바다 미션 제출합니다.',
      status: 'merged',
      submittedAt: at('2025-02-20T10:00:00.000Z'),
      memberId: be7.id,
      missionRepoId: racing.id,
    },
  ];
  for (const data of submissions) await prisma.submission.create({ data });

  const posts = [
    {
      url: 'https://haru.example.com/posts/1',
      title: '로또 미션 회고',
      publishedAt: at('2026-09-29T12:00:00.000Z'),
      memberId: fe8.id,
      cohort: 8,
      track: 'frontend',
      workspaceId,
      viewCount: 3,
      createdAt: at('2026-09-29T13:00:00.000Z'),
    },
    {
      url: 'https://bada.example.com/posts/1',
      title: 'JPA &amp; 트랜잭션',
      publishedAt: at('2026-09-20T09:00:00.000Z'),
      memberId: be7.id,
      cohort: 7,
      track: 'backend',
      workspaceId,
      createdAt: at('2026-09-20T10:00:00.000Z'),
    },
    {
      url: 'https://team.example.com/posts/1',
      title: '팀 회고',
      authorName: '하루',
      publishedAt: at('2026-09-28T08:00:00.000Z'),
      memberId: teamMember.id,
      workspaceId,
      createdAt: at('2026-09-28T09:00:00.000Z'),
    },
    {
      url: 'https://haru.example.com/posts/old',
      title: '오래된 글',
      publishedAt: at('2026-05-01T00:00:00.000Z'),
      memberId: fe8.id,
      cohort: 8,
      track: 'frontend',
      workspaceId,
      createdAt: at('2026-05-01T01:00:00.000Z'),
    },
  ];
  for (const data of posts) await prisma.blogPost.create({ data });

  await prisma.activityLog.create({
    data: {
      type: 'sync',
      message: '레포 동기화 완료',
      source: 'system',
      workspaceId,
      createdAt: at('2026-09-30T05:00:00.000Z'),
    },
  });
  await prisma.activityLog.create({
    data: {
      type: 'profile_refresh',
      message: 'fe-crew 프로필 새로고침',
      source: 'client',
      memberGithubId: 'fe-crew',
      metadata: JSON.stringify({ remainingSeconds: 0, requestCount: 1 }),
      workspaceId,
      createdAt: at('2026-09-30T06:00:00.000Z'),
    },
  });

  await prisma.nicknameBannedWord.create({
    data: { word: '금지어', workspaceId, createdAt: at('2026-02-01T00:00:00.000Z') },
  });
  await prisma.ignoredDomain.create({
    data: { domain: 'ignored.example.com', workspaceId, createdAt: at('2026-02-01T00:00:00.000Z') },
  });

  await prisma.tecoTalk.create({
    data: {
      videoId: 'video-matched',
      title: '[테코톡] 하루의 렌더링',
      url: 'https://www.youtube.com/watch?v=video-matched',
      thumbnailUrl: 'https://i.ytimg.com/vi/video-matched/hqdefault.jpg',
      speakerNickname: '하루',
      uploadedAt: at('2026-06-01T10:00:00.000Z'),
      viewCount: 120,
      cohort: 8,
      matchStatus: 'matched',
      workspaceId,
      createdAt: at('2026-06-02T00:00:00.000Z'),
      updatedAt: at('2026-06-02T00:00:00.000Z'),
      speakers: { create: [{ memberId: fe8.id }] },
    },
  });
  await prisma.tecoTalk.create({
    data: {
      videoId: 'video-unmatched',
      title: '[테코톡] 누군가의 발표',
      url: 'https://www.youtube.com/watch?v=video-unmatched',
      speakerNickname: '모름',
      uploadedAt: at('2025-06-01T10:00:00.000Z'),
      viewCount: 40,
      cohort: 7,
      matchStatus: 'unmatched',
      workspaceId,
      createdAt: at('2025-06-02T00:00:00.000Z'),
      updatedAt: at('2025-06-02T00:00:00.000Z'),
    },
  });

  return { workspaceId, fe8, be7, an6, coachMember, teamMember, person, lotto, racing };
}
