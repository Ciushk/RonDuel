import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const SHOTS_DIR = process.env.RONTOWN_SHOTS_DIR || '';

function shotPath(name: string): string | null {
  return SHOTS_DIR ? path.join(SHOTS_DIR, name) : null;
}

function buildLand(): Record<string, string> {
  const land: Record<string, string> = {};
  for (let x = 2; x <= 5; x++) {
    for (let y = 2; y <= 5; y++) {
      land[`${x}_${y}`] = 'basic-block';
    }
  }
  land['3_4'] = 'basic-block-dirt';
  return land;
}

async function seedSessionAndRoutes(page: Page, uid: string): Promise<void> {
  await page.addInitScript((sessionUid: string) => {
    window.localStorage.setItem(
      'ronduel_session_v1',
      JSON.stringify({
        uid: sessionUid,
        nickname: 'BubbleTester',
        ageConfirmed16: true,
        relaxedTimer: false,
        theme: 'light',
        analyticsConsent: 'rejected',
      }),
    );
    window.localStorage.setItem('ff_town_enabled', '1');
  }, uid);
  await page.route('**/api/town/inventory*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ crops: {} }),
    });
  });
  await page.route('**/api/town/orders*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ orders: [], unlocked: false }),
    });
  });
}

test.use({
  viewport: { width: 390, height: 844 },
  serviceWorkers: 'block',
  launchOptions: { args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-gpu'] },
});

test.describe('RonTown Pixel-Art Villager Joy Bubbles', () => {
  test('shows pixel-art joy bubble <img> sprites above villagers when harvesting a ready crop', async ({
    page,
  }) => {
    const now = Date.now();
    await seedSessionAndRoutes(page, 'u_e2e_bubbles_1');
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          town: {
            gridSize: 8,
            population: 5,
            housingCapacity: 6,
            serviceCapacity: 6,
            populationCap: 6,
            level: 1,
            maxLevelReached: 1,
            tutorialStep: 3,
            likesCount: 0,
            plotsOwned: 1,
            land: buildLand(),
          },
          tiles: {
            '3_3': { x: 3, y: 3, itemId: 'starter_house' },
            '3_4': {
              x: 3,
              y: 4,
              itemId: 'plot',
              cropId: 'wheat',
              plantedAt: new Date(now - 5 * 3600_000).toISOString(),
              readyAt: new Date(now - 60_000).toISOString(),
            },
          },
          walletBalance: 200,
          inventory: {},
          orders: [],
          ordersUnlocked: true,
        }),
      });
    });
    await page.route('**/api/town/harvest*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, cropId: 'wheat', yieldCount: 2 }),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });

    // Every villager bubble is an <img> with pixelated rendering and pointer-events: none
    const bubbles = page.locator('img[data-villager-bubble]');
    await expect(bubbles.first())
      .toBeVisible({ timeout: 10_000 })
      .catch(() => {});
    expect(await bubbles.count()).toBeGreaterThanOrEqual(4);
    await expect(bubbles.first()).toHaveCSS('pointer-events', 'none');

    // Trigger harvest so nearby residents react with distinct pixel-art joy bubbles
    const harvestBtn = page.locator('button[aria-label*="Harvest ready wheat"]');
    await expect(harvestBtn).toBeVisible();
    await harvestBtn.click({ force: true });

    // Wait for at least one villager joy bubble to become visibly opaque (> 0.5)
    await expect
      .poll(
        async () => {
          return page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img[data-villager-bubble]'));
            return imgs.filter((el) => Number(getComputedStyle(el).opacity) > 0.5).length;
          });
        },
        { timeout: 12_000, intervals: [100, 150, 200] },
      )
      .toBeGreaterThanOrEqual(1);

    const activeBubbleSrcs = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img[data-villager-bubble]'));
      return imgs
        .filter((el) => Number(getComputedStyle(el).opacity) > 0.3)
        .map((el) => el.getAttribute('src') || '');
    });
    expect(activeBubbleSrcs.length).toBeGreaterThanOrEqual(1);
    for (const src of activeBubbleSrcs) {
      expect(src).toMatch(/\/rontown\/ui\/bubble-(heart|smile|star|wheat|exclaim|note)@2x\.png/);
    }

    const shot = shotPath('rontown_bubbles_390.png');
    if (shot) {
      await page.screenshot({ path: shot });
    }
  });
});
