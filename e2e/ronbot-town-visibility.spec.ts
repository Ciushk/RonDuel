import { expect, test } from '@playwright/test';

test.describe('RonBot route visibility', () => {
  test('does not mount or download RonBot on /en/town, and shows it on /en/leagues', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('ronduel_splash_seen_v2', '1');
      window.localStorage.setItem(
        'ronduel_session_v1',
        JSON.stringify({
          uid: 'u_e2e_ronbot_vis',
          nickname: 'E2ETester',
          ageConfirmed16: true,
          relaxedTimer: false,
          theme: 'light',
          analyticsConsent: 'rejected',
        }),
      );
    });

    const townScriptUrls: string[] = [];
    const onTownResponse = async (res: import('@playwright/test').Response) => {
      const url = res.url();
      if (url.includes('/_next/static/chunks/') && url.endsWith('.js')) {
        townScriptUrls.push(url);
      }
    };
    page.on('response', onTownResponse);

    await page.goto('/en/town', { waitUntil: 'load' });
    // Wait longer than DeferredRonBot idle deferral (1200ms timeout / 300ms fallback)
    await page.waitForTimeout(2500);

    await expect(page.getByRole('button', { name: 'Open the RonBot AI assistant' })).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'RonBot AI chat' })).toHaveCount(0);
    await expect(page.locator('.ronbot-anchor')).toHaveCount(0);

    // Ensure none of the JS chunks downloaded on /en/town contain the RonBotMascot bundle
    for (const url of townScriptUrls) {
      const res = await page.request.get(url);
      const body = await res.text();
      expect(body, `RonBotMascot chunk should not be requested on /en/town (${url})`).not.toContain(
        'ronduel_ronbot_history_v1',
      );
    }
    page.off('response', onTownResponse);

    // Navigate to a non-town, non-play, non-admin route (/en/leagues): RonBot should load and appear
    await page.goto('/en/leagues', { waitUntil: 'load' });
    await expect(page.getByRole('button', { name: 'Open the RonBot AI assistant' })).toBeVisible({
      timeout: 5000,
    });

    // Existing /en/play hide still works
    await page.goto('/en/play', { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    await expect(page.getByRole('button', { name: 'Open the RonBot AI assistant' })).toHaveCount(0);
    await expect(page.locator('.ronbot-anchor')).toHaveCount(0);
  });
});
