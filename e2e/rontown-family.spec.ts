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
  return land;
}

async function seedSessionAndRoutes(page: Page, uid: string): Promise<void> {
  await page.addInitScript((sessionUid: string) => {
    window.localStorage.setItem(
      'ronduel_session_v1',
      JSON.stringify({
        uid: sessionUid,
        nickname: 'FamilyTester',
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

function makePayload(opts: { createdAtMs: number; childBorn: boolean }) {
  return {
    town: {
      gridSize: 8,
      population: 6,
      housingCapacity: 8,
      serviceCapacity: 8,
      populationCap: 8,
      level: 1,
      maxLevelReached: 1,
      tutorialStep: 3,
      likesCount: 0,
      plotsOwned: 1,
      land: buildLand(),
      createdAt: opts.createdAtMs,
      childBorn: opts.childBorn,
    },
    tiles: {
      '3_3': { x: 3, y: 3, itemId: 'starter_house' },
      '4_4': { x: 4, y: 4, itemId: 'plot' },
    },
    walletBalance: 250,
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

test.describe('RonTown One-Time Family Event & Single Child Invariant', () => {
  test('15-day-old town plays choreography once, shows floating hearts, spawns 1 child, and POSTs complete', async ({
    page,
  }) => {
    let completeCalls = 0;
    const fifteenDaysAgo = Date.now() - 15 * 86_400_000;

    await seedSessionAndRoutes(page, 'u_e2e_family_15d');
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makePayload({ createdAtMs: fifteenDaysAgo, childBorn: false })),
      });
    });
    await page.route('**/api/town/family-event/complete*', async (route) => {
      completeCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, childBorn: true, alreadyBorn: false }),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });

    // Hearts appear over starter house roof
    await expect(page.getByTestId('family-heart-float').first()).toBeVisible({ timeout: 6_000 });

    // Single resident-child spawns and POST /api/town/family-event/complete fires once
    await expect(page.locator('[data-villager-id="resident-child"]')).toBeVisible({
      timeout: 6_000,
    });
    await expect(page.locator('[data-villager-kind="child-villager"]')).toHaveCount(1);

    const shot = shotPath('rontown_family_390.png');
    if (shot) {
      await page.screenshot({ path: shot });
    }

    await expect.poll(() => completeCalls, { timeout: 5_000 }).toBe(1);
    await expect(page.getByTestId('family-live')).toContainText(/child/i);
  });

  test('town with childBorn: true renders exactly 1 child with zero hearts and zero complete POSTs', async ({
    page,
  }) => {
    let completeCalls = 0;
    const twentyDaysAgo = Date.now() - 20 * 86_400_000;

    await seedSessionAndRoutes(page, 'u_e2e_family_born');
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makePayload({ createdAtMs: twentyDaysAgo, childBorn: true })),
      });
    });
    await page.route('**/api/town/family-event/complete*', async (route) => {
      completeCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, childBorn: true, alreadyBorn: true }),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-villager-id="resident-child"]')).toBeVisible();
    await expect(page.locator('[data-villager-kind="child-villager"]')).toHaveCount(1);

    await page.waitForTimeout(1200);
    await expect(page.getByTestId('family-hearts-overlay')).toHaveCount(0);
    expect(completeCalls).toBe(0);
  });

  test('3-day-old town spawns zero children, shows zero hearts, and makes zero complete POSTs', async ({
    page,
  }) => {
    let completeCalls = 0;
    const threeDaysAgo = Date.now() - 3 * 86_400_000;

    await seedSessionAndRoutes(page, 'u_e2e_family_3d');
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makePayload({ createdAtMs: threeDaysAgo, childBorn: false })),
      });
    });
    await page.route('**/api/town/family-event/complete*', async (route) => {
      completeCalls += 1;
      await route.fulfill({ status: 409, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1200);
    await expect(page.locator('[data-villager-kind="child-villager"]')).toHaveCount(0);
    await expect(page.getByTestId('family-hearts-overlay')).toHaveCount(0);
    expect(completeCalls).toBe(0);
  });
});
