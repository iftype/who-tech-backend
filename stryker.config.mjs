// 뮤테이션 테스트 (npm run test:mutation). 느리므로 PR마다가 아니라 주간 워크플로에서 실행한다.
// 대상은 테스트가 있는 순수 로직부터 좁게 잡는다 (IMPROVEMENT_PLAN Phase 7)
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'npm',
  testRunner: 'jest',
  testRunnerNodeArgs: ['--experimental-vm-modules'],
  jest: { configFile: 'jest.config.cjs', enableFindRelatedTests: true },
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  mutate: [
    'src/shared/nickname.ts',
    'src/shared/validation.ts',
    'src/features/workspace/workspace.validation.ts',
    'src/features/repo/repo.validation.ts',
    'src/shared/member-cohort.ts',
    'src/shared/member-track.ts',
    'src/features/sync/sync.pr-parser.ts',
    'src/features/tecotalk/tecotalk.parser.ts',
    'src/features/member/member.profile-refresh.ts',
    'src/features/member/member.cohort-recalc.ts',
  ],
  coverageAnalysis: 'perTest',
  thresholds: { high: 80, low: 70, break: 70 },
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  tempDirName: '.stryker-tmp',
  concurrency: 4,
  timeoutMS: 30000,
};
