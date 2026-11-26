import { expect, test } from '@playwright/test';

async function seedLocalSession(page: import('@playwright/test').Page, uid: string) {
  await page.addInitScript((sessionUid) => {
    window.sessionStorage.setItem('ronduel_splash_seen_v2', '1');
    window.localStorage.setItem(
      'ronduel_session_v1',
      JSON.stringify({
        uid: sessionUid,
        nickname: 'E2ETester',
        ageConfirmed16: true,
        relaxedTimer: false,
        theme: 'light',
        analyticsConsent: 'rejected',
      }),
    );
  }, uid);
}

test.describe('RonBot Pro-only & route visibility', () => {
  test.use({ serviceWorkers: 'block' });

  test('non-Pro user does not see RonBot or download its chunk on /en/leagues or /en/town', async ({
    page,
  }) => {
    await seedLocalSession(page, 'u_e2e_free_ronbot');

    await page.route('**/api/me/profile**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          uid: 'u_e2e_free_ronbot',
          nickname: 'E2ETester',
          pro: { active: false },
        }),
      });
    });

    const chunkUrls: string[] = [];
    page.on('response', (res) => {
      const url = res.url();
      if (url.includes('/_next/static/chunks/') && url.endsWith('.js')) {
        chunkUrls.push(url);
      }
    });

    await page.goto('/en/leagues', { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    await expect(page.getByRole('button', { name: 'Open the RonBot AI assistant' })).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'RonBot AI chat' })).toHaveCount(0);
    await expect(page.locator('.ronbot-anchor')).toHaveCount(0);

    await page.goto('/en/town', { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    await expect(page.getByRole('button', { name: 'Open the RonBot AI assistant' })).toHaveCount(0);
    await expect(page.locator('.ronbot-anchor')).toHaveCount(0);

    for (const url of [...new Set(chunkUrls)]) {
      const res = await page.request.get(url);
      const body = await res.text();
      expect(body, `RonBotMascot chunk should not load for non-Pro (${url})`).not.toContain(
        'ronduel_ronbot_history_v1',
      );
    }
  });

  test('Pro user sees RonBot on /en/leagues, but not on /en/town or /en/play', async ({ page }) => {
    await seedLocalSession(page, 'u_e2e_pro_ronbot');

    await page.route('**/api/me/profile**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          uid: 'u_e2e_pro_ronbot',
          nickname: 'ProMayor',
          pro: { active: true, plan: 'yearly' },
        }),
      });
    });

    // Pro on /en/town: must still stay hidden and not download mascot chunk
    const townChunkUrls: string[] = [];
    const onTownRes = (res: import('@playwright/test').Response) => {
      const url = res.url();
      if (url.includes('/_next/static/chunks/') && url.endsWith('.js')) {
        townChunkUrls.push(url);
      }
    };
    page.on('response', onTownRes);

    await page.goto('/en/town', { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    await expect(page.getByRole('button', { name: 'Open the RonBot AI assistant' })).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'RonBot AI chat' })).toHaveCount(0);
    await expect(page.locator('.ronbot-anchor')).toHaveCount(0);

    for (const url of [...new Set(townChunkUrls)]) {
      const res = await page.request.get(url);
      const body = await res.text();
      expect(body, `RonBotMascot chunk should not load on /en/town for Pro (${url})`).not.toContain(
        'ronduel_ronbot_history_v1',
      );
    }
    page.off('response', onTownRes);

    // Pro on /en/leagues: launcher appears after idle deferral
    await page.goto('/en/leagues', { waitUntil: 'load' });
    await expect(page.getByRole('button', { name: 'Open the RonBot AI assistant' })).toBeVisible({
      timeout: 5000,
    });

    // Pro on /en/play: existing play hide still works
    await page.goto('/en/play', { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    await expect(page.getByRole('button', { name: 'Open the RonBot AI assistant' })).toHaveCount(0);
    await expect(page.locator('.ronbot-anchor')).toHaveCount(0);
  });

  test('POST /api/chat returns 403 pro_required without a verified Pro token', async ({
    request,
  }) => {
    const res = await request.post('/api/chat', {
      data: { message: 'hello', uid: 'u_free', locale: 'en' },
    });
    expect(res.status()).toBe(403);
    expect(await res.json()).toEqual({ error: 'pro_required' });
  });
});
