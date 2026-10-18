import { defineConfig, devices } from '@playwright/test';

// 어드민 화면 스크린샷 비교 테스트 (ARCHITECTURE_PLAN A-2). 구조 리팩토링이 어드민 화면을 바꾸지 않았는지 픽셀 단위로 확인한다.
// 어드민 빌드는 버전 표시를 고정해 미리 해 둔다 (npm run build:admin-visual)
// 기준 이미지는 CI(Linux)에서 만든다. 로컬(macOS)은 폰트 렌더링이 달라 비교 대상이 아니다
const PORT = 3200;

export default defineConfig({
  testDir: './e2e/admin',
  testMatch: '*.visual.ts',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  expect: { toHaveScreenshot: { maxDiffPixels: 0 } },
  // 어드민은 절대 시각을 보여주므로 시간대·로케일을 고정한다 (CI는 UTC, 로컬은 KST)
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    timezoneId: 'Asia/Seoul',
    locale: 'ko-KR',
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  webServer: {
    command: 'npx tsx e2e/admin/server.ts',
    url: `http://127.0.0.1:${PORT}/health`,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
