/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.(ts|js)$': ['@swc/jest', { jsc: { target: 'es2022' } }],
  },
  transformIgnorePatterns: ['node_modules/(?!(@octokit)/)'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  // 모든 테스트는 임시 SQLite만 사용한다 (dev.db·운영 DB 보호)
  globalSetup: '<rootDir>/src/__tests__/setup/global-setup.mjs',
  globalTeardown: '<rootDir>/src/__tests__/setup/global-teardown.mjs',
  setupFiles: ['<rootDir>/src/__tests__/setup/test-db.mjs'],
  // 서버 런타임 코드만 측정 (admin-spa는 별도 프론트, scripts·seed는 일회성 CLI)
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/public/**',
    '!src/scripts/**',
    '!src/db/seed.ts',
    '!src/db/cleanup-nickname-stats.ts',
  ],
  // 래칫: 현재 실측값을 하한으로 CI에서 강제하고, 테스트를 추가할 때마다 올린다 (목표 lines/functions 60)
  coverageThreshold: {
    global: {
      lines: 53,
      functions: 46,
    },
  },
  testTimeout: 15000,
  verbose: true,
};
