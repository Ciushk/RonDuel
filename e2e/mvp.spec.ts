import { expect, test } from '@playwright/test';

test.describe('Phase 1 MVP core loop', () => {
  test('new visitor plays a full 6-item round without an account, never receives correctIndex beforehand, and shares to create a league', async ({
    page,
    request,
  }) => {
    // Track network payloads from /api/game/start to assert anti-cheat
    const startPayloads: string[] = [];
    page.on('response', async (res) => {
      if (res.url().includes('/api/game/start') && res.status() === 200) {
        startPayloads.push(await res.text());
      }
    });

    await page.goto('/en');
    await expect(page.getByText('The daily duel for your group chat.')).toBeVisible();

    // Tap 1: Play today's round -> opens nickname sheet
    await page.getByRole('button', { name: "Play today's round" }).click();
    await expect(page.getByRole('dialog', { name: 'Pick your nickname' })).toBeVisible();

    // Tap 2: Confirm nickname & 16+ -> goes to /en/play
    await page.getByRole('textbox', { name: 'Nickname', exact: true }).fill('TestPlayer');
    await page.getByRole('button', { name: "Join & play today's round" }).click();
    await expect(page).toHaveURL(/\/en\/play/);

    // Tap 3: Start 3-2-1 countdown
    await page.getByRole('button', { name: 'Start 3-2-1' }).click();

    // Wait for first question (1/6)
    await expect(page.getByText('1/6')).toBeVisible({ timeout: 10_000 });

    // Assert anti-cheat: start payload must NEVER contain correctIndex or correctOrder
    expect(startPayloads.length).toBeGreaterThan(0);
    expect(startPayloads[0]).not.toContain('correctIndex');
    expect(startPayloads[0]).not.toContain('correctOrder');

    // Answer all 6 items
    for (let i = 1; i <= 6; i += 1) {
      await expect(page.getByText(`${i}/6`)).toBeVisible({ timeout: 10_000 });
      const lockOrderBtn = page.getByRole('button', { name: 'Lock in order' });
      if (await lockOrderBtn.isVisible()) {
        await lockOrderBtn.click();
      } else {
        // Click first option button inside the question card
        await page.locator('main button.rd-sticker').first().click();
      }
    }

    // Should land on /en/result/[playId]
    await expect(page).toHaveURL(/\/en\/result\//, { timeout: 10_000 });
    await expect(page.getByText('Your score')).toBeVisible();

    // Share creates a league automatically
    await page.getByRole('button', { name: 'Share to your group' }).click();
    await expect(page.getByRole('link', { name: /Open league leaderboard/i })).toBeVisible({
      timeout: 5_000,
    });

    // Verify PWA manifest is served
    const manifestRes = await request.get('/manifest.webmanifest');
    expect(manifestRes.status()).toBe(200);
    const manifest = await manifestRes.json();
    expect(manifest.name).toBe('RonDuel');

    // Verify dynamic OG image endpoint returns PNG
    const ogRes = await request.get('/api/og/league/TEST99');
    expect(ogRes.status()).toBe(200);
    expect(ogRes.headers()['content-type']).toContain('image/png');
  });

  test('Romanian locale renders with diacritics', async ({ page }) => {
    await page.goto('/ro');
    await expect(page.getByText('Duelul zilnic pentru grupul tău de prieteni.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Joacă runda de azi' })).toBeVisible();
  });
});
