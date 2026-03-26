import prisma from './prisma.js';

type RepoSeed = { name: string; track: string; type?: string };

const INITIAL_REPOS: RepoSeed[] = [
  // frontend - individual
  { name: 'javascript-racingcar', track: 'frontend' },
  { name: 'javascript-lotto', track: 'frontend' },
  { name: 'javascript-movie-review', track: 'frontend' },
  { name: 'javascript-lunch', track: 'frontend' },
  { name: 'javascript-calculator', track: 'frontend' },
  { name: 'javascript-own-ui-library', track: 'frontend' },
  { name: 'react-shopping-cart', track: 'frontend' },
  { name: 'react-shopping-products', track: 'frontend' },
  { name: 'react-payments', track: 'frontend' },
  { name: 'react-lunch', track: 'frontend' },
  { name: 'react-movie-review', track: 'frontend' },
  { name: 'react-ssr', track: 'frontend' },
  { name: 'react-modules', track: 'frontend' },
  { name: 'react-basecamp', track: 'frontend' },
  { name: 'layout-component', track: 'frontend' },
  { name: 'perf-basecamp', track: 'frontend' },
  { name: 'a11y-airline', track: 'frontend' },
  { name: 'frontend-rendering', track: 'frontend' },
  // frontend - integration
  { name: 'gemini-canvas-mission', track: 'frontend', type: 'integration' },
  // backend - individual
  { name: 'java-racingcar', track: 'backend' },
  { name: 'java-lotto', track: 'backend' },
  { name: 'java-blackjack', track: 'backend' },
  { name: 'java-ladder', track: 'backend' },
  { name: 'java-chess', track: 'backend' },
  { name: 'java-attendance', track: 'backend' },
  { name: 'java-janggi', track: 'backend' },
  { name: 'java-aop', track: 'backend' },
  { name: 'java-di', track: 'backend' },
  { name: 'java-http', track: 'backend' },
  { name: 'java-jdbc', track: 'backend' },
  { name: 'java-mvc', track: 'backend' },
  { name: 'spring-roomescape-admin', track: 'backend' },
  { name: 'spring-roomescape-member', track: 'backend' },
  { name: 'spring-roomescape-payment', track: 'backend' },
  { name: 'spring-roomescape-waiting', track: 'backend' },
  { name: 'jwp-shopping-order', track: 'backend' },
  { name: 'kotlin-racingcar', track: 'backend' },
  { name: 'kotlin-lotto', track: 'backend' },
  { name: 'kotlin-blackjack', track: 'backend' },
  { name: 'kotlin-omok', track: 'backend' },
  // android - individual
  { name: 'android-signup', track: 'android' },
  { name: 'android-paint', track: 'android' },
  { name: 'android-movie-ticket', track: 'android' },
  { name: 'android-movie-theater', track: 'android' },
  { name: 'android-shopping-cart', track: 'android' },
  { name: 'android-shopping-cart-compose', track: 'android' },
  { name: 'android-shopping-order', track: 'android' },
  { name: 'android-payments', track: 'android' },
  { name: 'android-di', track: 'android' },
  { name: 'kotlin-rss-reader', track: 'android' },
];

async function seed() {
  const existing = await prisma.workspace.findUnique({ where: { name: 'woowacourse' } });

  if (existing) {
    console.log('workspace already exists, skipping seed');
    return;
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: 'woowacourse',
      githubOrg: 'woowacourse',
      nicknameRegex: '\\[.+\\] (.+) 미션 제출합니다',
      cohortRules: JSON.stringify([
        { year: 2019, cohort: 1 },
        { year: 2020, cohort: 2 },
        { year: 2021, cohort: 3 },
        { year: 2022, cohort: 4 },
        { year: 2023, cohort: 5 },
        { year: 2024, cohort: 6 },
        { year: 2025, cohort: 7 },
        { year: 2026, cohort: 8 },
      ]),
    },
  });

  await prisma.missionRepo.createMany({
    data: INITIAL_REPOS.map((repo) => ({
      name: repo.name,
      repoUrl: `https://github.com/woowacourse/${repo.name}`,
      track: repo.track,
      type: repo.type ?? 'individual',
      workspaceId: workspace.id,
    })),
  });

  console.log(`workspace seeded with ${INITIAL_REPOS.length} repos`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
