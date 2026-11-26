import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const RESULT_PAYLOAD = {
  playId: 'play_install_e2e_1',
  date: '2026-11-26',
  roundNumber: 42,
  totalScore: 860,
  totalMs: 13200,
  emojiLine: '⚡🟩🟩⚡🟩🟥',
  streakCurrent: 1,
  streakBest: 1,
  finishedPlaysCount: 1,
  review: [],
  leagueRanks: [],
  primaryLeague: null,
};

test.describe('Install App Popup (Android/Chromium + iOS/iPadOS)', () => {
  test('manifest exposes id: "/" and scope: "/"', async ({ request }) => {
    const res = await request.get('/manifest.json');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('/');
    expect(json.scope).toBe('/');
  });

  test('Chromium/Android shows install sheet on result page, passes axe WCAG AA, and accepts install', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.addInitScript(() => {
      window.localStorage.setItem(
        'ronduel_session_v1',
        JSON.stringify({
          uid: 'u_e2e_install_and',
          nickname: 'Tester',
          email: 'tester@example.com',
          ageConfirmed16: true,
          isAnonymous: false,
          analyticsConsent: 'denied',
          theme: 'light',
        }),
      );
      window.sessionStorage.setItem('ronduel_splash_seen', '1');
      window.sessionStorage.setItem('rd-result-seen-play_install_e2e_1', '1');
    });

    await page.route('**/api/game/result/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(RESULT_PAYLOAD),
      });
    });

    await page.route('**/api/me/profile**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pro: { active: false } }),
      });
    });

    await page.goto('/en/result/play_install_e2e_1');
    await expect(page.getByRole('heading', { name: 'Round #42 complete' })).toBeVisible({
      timeout: 10000,
    });

    // Simulate Chromium firing beforeinstallprompt after AppShell mounts
    await page.evaluate(() => {
      const evt = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: 'accepted'; platform: string }>;
      };
      evt.prompt = () => Promise.resolve();
      evt.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
      window.dispatchEvent(evt);
    });

    const sheet = page.getByTestId('install-app-sheet');
    await expect(sheet).toBeVisible({ timeout: 8000 });
    await expect(sheet).toHaveAttribute('data-platform', 'chromium-prompt');
    await expect(page.getByTestId('install-cta-btn')).toBeVisible();

    if (process.env.INSTALL_ANDROID_SCREENSHOT_PATH) {
      await page.waitForTimeout(350);
      await page.screenshot({
        path: process.env.INSTALL_ANDROID_SCREENSHOT_PATH,
        fullPage: false,
      });
    }

    const axeResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const seriousOrCritical = axeResults.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(seriousOrCritical).toEqual([]);

    // Accept install -> thanks banner appears, then closes
    await page.getByTestId('install-cta-btn').click();
    await expect(page.getByTestId('install-thanks-banner')).toBeVisible();
    await expect(sheet).toBeHidden({ timeout: 4000 });

    const stored = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('rd_install_state') || '{}'),
    );
    expect(stored.done).toBe(true);
    expect(stored.installed).toBe(true);
  });

  test('iPhone Safari shows 3-step pixel-art how-to with bouncing pointer and passes axe WCAG AA', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        value:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      });
      Object.defineProperty(navigator, 'platform', { configurable: true, value: 'iPhone' });
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });

      window.localStorage.setItem(
        'ronduel_session_v1',
        JSON.stringify({
          uid: 'u_e2e_install_ios',
          nickname: 'Tester',
          email: 'tester@example.com',
          ageConfirmed16: true,
          isAnonymous: false,
          analyticsConsent: 'denied',
          theme: 'light',
        }),
      );
      window.sessionStorage.setItem('ronduel_splash_seen', '1');
      window.sessionStorage.setItem('rd-result-seen-play_install_e2e_1', '1');
    });

    await page.route('**/api/game/result/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(RESULT_PAYLOAD),
      });
    });

    await page.route('**/api/me/profile**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pro: { active: false } }),
      });
    });

    await page.goto('/en/result/play_install_e2e_1');

    const sheet = page.getByTestId('install-app-sheet');
    await expect(sheet).toBeVisible({ timeout: 8000 });
    await expect(sheet).toHaveAttribute('data-platform', 'ios-howto');
    await expect(sheet.locator('ol > li')).toHaveCount(3);
    await expect(page.getByTestId('install-ios-pointer')).toBeVisible();
    await expect(page.getByTestId('install-ios-note')).toContainText('iOS 16.4+');

    if (process.env.INSTALL_IOS_SCREENSHOT_PATH) {
      await page.waitForTimeout(450);
      await page.screenshot({
        path: process.env.INSTALL_IOS_SCREENSHOT_PATH,
        fullPage: false,
      });
    }

    const axeResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const seriousOrCritical = axeResults.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(seriousOrCritical).toEqual([]);

    await page.getByTestId('install-got-it-btn').click();
    await expect(sheet).toBeHidden();
  });

  test('iPadOS (MacIntel + touch points) shows iOS how-to WITHOUT the bottom iPhone pointer', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        value:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      });
      Object.defineProperty(navigator, 'platform', { configurable: true, value: 'MacIntel' });
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });

      window.localStorage.setItem(
        'ronduel_session_v1',
        JSON.stringify({
          uid: 'u_e2e_install_ipad',
          nickname: 'Tester',
          email: 'tester@example.com',
          ageConfirmed16: true,
          isAnonymous: false,
          analyticsConsent: 'denied',
          theme: 'light',
        }),
      );
      window.sessionStorage.setItem('ronduel_splash_seen', '1');
      window.sessionStorage.setItem('rd-result-seen-play_install_e2e_1', '1');
    });

    await page.route('**/api/game/result/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(RESULT_PAYLOAD),
      });
    });

    await page.route('**/api/me/profile**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pro: { active: false } }),
      });
    });

    await page.goto('/en/result/play_install_e2e_1');

    const sheet = page.getByTestId('install-app-sheet');
    await expect(sheet).toBeVisible({ timeout: 8000 });
    await expect(sheet).toHaveAttribute('data-platform', 'ios-howto');
    await expect(page.getByTestId('install-ios-pointer')).toHaveCount(0);
  });
});
