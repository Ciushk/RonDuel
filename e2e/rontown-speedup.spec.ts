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
  land['4_4'] = 'basic-block-dirt';
  return land;
}

async function seedSessionAndRoutes(page: Page, uid: string): Promise<void> {
  await page.addInitScript((sessionUid: string) => {
    window.localStorage.setItem(
      'ronduel_session_v1',
      JSON.stringify({
        uid: sessionUid,
        nickname: 'SpeedupTester',
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

function makeInitPayload(opts: { speedupEnabled: boolean; walletBalance: number }) {
  const now = Date.now();
  return {
    town: {
      gridSize: 8,
      population: 2,
      housingCapacity: 4,
      serviceCapacity: 4,
      populationCap: 4,
      level: 1,
      maxLevelReached: 1,
      tutorialStep: 3,
      likesCount: 0,
      plotsOwned: 2,
      land: buildLand(),
    },
    tiles: {
      '3_3': { x: 3, y: 3, itemId: 'starter_house' },
      '3_4': {
        x: 3,
        y: 4,
        itemId: 'plot',
        cropId: 'wheat',
        plantedAt: new Date(now - 10 * 60_000).toISOString(),
        readyAt: new Date(now + 3 * 3600_000).toISOString(),
      },
      '4_4': { x: 4, y: 4, itemId: 'plot' },
    },
    walletBalance: opts.walletBalance,
    features: { speedupEnabled: opts.speedupEnabled },
    inventory: {},
    orders: [],
    ordersUnlocked: true,
  };
}

test.use({
  viewport: { width: 390, height: 844 },
  serviceWorkers: 'block',
  launchOptions: { args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-gpu'] },
});

test.describe('RonTown Harvest Speed-Up (gated by speedupEnabled)', () => {
  test('hides speed-up chip when features.speedupEnabled is false', async ({ page }) => {
    await seedSessionAndRoutes(page, 'u_e2e_speedup_off');
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeInitPayload({ speedupEnabled: false, walletBalance: 100 })),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('speedup-chip-3_4')).toHaveCount(0);
  });

  test('shows Volt chip when enabled, opens confirm sheet, debits Option C cost (wheat=4), and flips plot to Ready', async ({
    page,
  }) => {
    const speedupBodies: Array<{ x: number; y: number; expectedCost: number }> = [];

    await seedSessionAndRoutes(page, 'u_e2e_speedup_on');
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeInitPayload({ speedupEnabled: true, walletBalance: 100 })),
      });
    });
    await page.route('**/api/town/speedup*', async (route) => {
      const body = route.request().postDataJSON() as {
        x: number;
        y: number;
        expectedCost: number;
      };
      speedupBodies.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          x: body.x,
          y: body.y,
          cropId: 'wheat',
          cost: 4,
          alreadyReady: false,
          readyAt: new Date(Date.now() - 1000).toISOString(),
          balanceAfter: 96,
        }),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });

    const chip = page.getByTestId('speedup-chip-3_4');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('4');

    // Open confirm sheet and capture 390px verification screenshot
    await chip.click({ force: true });
    const sheet = page.getByTestId('speedup-confirm-sheet');
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('speedup-confirm-cost')).toHaveText('4');

    const shot = shotPath('rontown_speedup_390.png');
    if (shot) {
      await page.screenshot({ path: shot });
    }

    // Confirm speed-up -> POST /api/town/speedup, balance 100 -> 96, plot becomes Ready
    await page.getByTestId('speedup-confirm-btn').click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId('speedup-chip-3_4')).toHaveCount(0);
    await expect(page.getByTestId('town-wallet-balance')).toHaveText('96');
    await expect(page.locator('button[aria-label*="Harvest ready wheat" i]')).toBeVisible();
    expect(speedupBodies).toEqual([expect.objectContaining({ x: 3, y: 4, expectedCost: 4 })]);
  });

  test('disables confirm button and explains shortage when balance < cost', async ({ page }) => {
    await seedSessionAndRoutes(page, 'u_e2e_speedup_low');
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeInitPayload({ speedupEnabled: true, walletBalance: 3 })),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('speedup-chip-3_4').click({ force: true });
    await expect(page.getByTestId('speedup-confirm-btn')).toBeDisabled();
    await expect(page.getByTestId('speedup-confirm-sheet')).toContainText('Need 4 RonCoins');
  });
});
