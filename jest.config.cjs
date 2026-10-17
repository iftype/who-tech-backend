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
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
  coverageThreshold: {
    global: {
      lines: 60,
      functions: 60,
    },
  },
  testTimeout: 15000,
  verbose: true,
};
