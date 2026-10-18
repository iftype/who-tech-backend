import { expect, test, type Page } from '@playwright/test';

// 어드민 탭별 화면을 고정 시드 데이터로 찍어 기준 이미지와 비교한다 (ARCHITECTURE_PLAN A-2)
const SECRET = 'visual-secret';
const SEED_NOW = new Date('2026-10-01T09:00:00.000Z');
const ADMIN = '/admin/ui/admin-dist/';

const TABS = ['members', 'sync', 'repos', 'blog', 'archive', 'persons', 'logs', 'settings'] as const;

async function open(page: Page, hash: string, loggedIn: boolean) {
  await page.clock.setFixedTime(SEED_NOW);
  if (loggedIn) await page.addInitScript((token) => localStorage.setItem('admin_token', token), SECRET);
  // GitHub 아바타 등 외부 이미지는 빈 응답으로 대체
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 204, body: '' }));
  await page.goto(`${ADMIN}#/${hash}`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
}

test('login', async ({ page }) => {
  await open(page, 'login', false);
  await expect(page).toHaveScreenshot('login.png', { fullPage: true });
});

for (const tab of TABS) {
  test(tab, async ({ page }) => {
    await open(page, tab, true);
    await expect(page).toHaveScreenshot(`${tab}.png`, { fullPage: true });
  });
}
