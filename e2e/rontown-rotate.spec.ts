import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const SHOTS_DIR = process.env.RONTOWN_SHOTS_DIR || '';

function shotPath(name: string): string | null {
  return SHOTS_DIR ? path.join(SHOTS_DIR, name) : null;
}

function buildTestLand(): Record<string, string> {
  const land: Record<string, string> = {};
  for (let x = 1; x <= 5; x++) {
    for (let y = 1; y <= 5; y++) {
      land[`${x}_${y}`] = 'basic-block';
    }
  }
  land['2_2'] = 'basic-block-wather-grass-50-50';
  land['2_3'] = 'basic-block-water-grass-20-80';
  land['4_2'] = 'basic-block-street';
  return land;
}

async function seedSessionAndRoutes(page: Page, uid: string): Promise<void> {
  await page.addInitScript((sessionUid: string) => {
    window.localStorage.setItem(
      'ronduel_session_v1',
      JSON.stringify({
        uid: sessionUid,
        nickname: 'RotateTester',
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

test.describe('RonTown Rotate mode + pixel-art Rotate toolbar button', () => {
  const basePayload = {
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
      plotsOwned: 1,
      land: buildTestLand(),
      landRot: {},
    },
    tiles: {
      '3_3': { x: 3, y: 3, itemId: 'starter_house' },
      '3_2': { x: 3, y: 2, itemId: 'fence' },
      '3_4': { x: 3, y: 4, itemId: 'fence' },
      '4_4': { x: 4, y: 4, itemId: 'plot' },
    },
    walletBalance: 500,
    inventory: {},
    orders: [],
    ordersUnlocked: true,
  };

  test('rotates shore 4 ways, flips fence via tap and R key, rejects grass, and persists payloads', async ({
    page,
  }) => {
    const rotatePayloads: Array<{ x: number; y: number; layer: string; rot: number }> = [];

    await seedSessionAndRoutes(page, 'u_e2e_rotate_1');
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(basePayload),
      });
    });
    await page.route('**/api/town/rotate*', async (route) => {
      const body = route.request().postDataJSON() as {
        x: number;
        y: number;
        layer: string;
        rot: number;
      };
      rotatePayloads.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          x: body.x,
          y: body.y,
          layer: body.layer,
          rot: body.rot,
        }),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });

    const rotateBtn = page.getByTestId('toolbar-rotate-btn');
    await expect(rotateBtn).toBeVisible();
    await expect(rotateBtn).toHaveAttribute('aria-pressed', 'false');

    const btnShot = shotPath('rontown_rotate_button_390.png');
    if (btnShot) {
      await page.screenshot({ path: btnShot });
    }

    // Toggle Rotate mode ON
    await rotateBtn.click();
    await expect(rotateBtn).toHaveAttribute('aria-pressed', 'true');

    // Shore tile (2,2): tap 3 times -> -r1, -r2, -r3
    const shoreImg = page.locator('[data-ground-tile="2_2"]');
    const shoreBtn = page.locator('button[aria-label*="(2, 2)"]');
    await expect(shoreImg).toHaveAttribute('src', /basic-block-wather-grass-50-50\.png/);

    await shoreBtn.click({ force: true });
    await expect(shoreImg).toHaveAttribute('src', /basic-block-wather-grass-50-50-r1\.png/);

    await shoreBtn.click({ force: true });
    await expect(shoreImg).toHaveAttribute('src', /basic-block-wather-grass-50-50-r2\.png/);

    await shoreBtn.click({ force: true });
    await expect(shoreImg).toHaveAttribute('src', /basic-block-wather-grass-50-50-r3\.png/);

    // Fence item (3,2): tap -> scaleX(-1)
    const fenceImg = page.locator('[data-item-tile="3_2"]');
    const fenceBtn = page.locator('button[aria-label*="(3, 2)"]');
    await fenceBtn.click({ force: true });
    await expect(fenceImg).toHaveCSS('transform', /matrix\(-1,\s*0,\s*0,\s*1/);

    // Wait briefly for 180ms feedback animation to settle, then capture rotate state
    await page.waitForTimeout(250);
    const rotShot = shotPath('rontown_rotate_390.png');
    if (rotShot) {
      await page.screenshot({ path: rotShot });
    }

    // Focus fence (3,4) and press R
    const fence2Btn = page.locator('button[aria-label*="(3, 4)"]');
    const fence2Img = page.locator('[data-item-tile="3_4"]');
    await fence2Btn.focus();
    await page.keyboard.press('r');
    await expect(fence2Img).toHaveCSS('transform', /matrix\(-1,\s*0,\s*0,\s*1/);

    // Check POST /api/town/rotate payloads
    expect(rotatePayloads).toEqual([
      expect.objectContaining({ x: 2, y: 2, layer: 'ground', rot: 1 }),
      expect.objectContaining({ x: 2, y: 2, layer: 'ground', rot: 2 }),
      expect.objectContaining({ x: 2, y: 2, layer: 'ground', rot: 3 }),
      expect.objectContaining({ x: 3, y: 2, layer: 'item', rot: 1 }),
      expect.objectContaining({ x: 3, y: 4, layer: 'item', rot: 1 }),
    ]);

    // Non-rotatable grass (1,1): toast shown, no extra POST
    const grassBtn = page.locator('button[aria-label*="(1, 1)"]');
    await grassBtn.click({ force: true });
    await expect(page.getByRole('alert')).toContainText(/cannot be rotated/i);
    expect(rotatePayloads).toHaveLength(5);
  });

  test('honors prefers-reduced-motion with instant sprite swap and no transform animation', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedSessionAndRoutes(page, 'u_e2e_rotate_rm');
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(basePayload),
      });
    });
    await page.route('**/api/town/rotate*', async (route) => {
      const body = route.request().postDataJSON() as {
        x: number;
        y: number;
        layer: string;
        rot: number;
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, ...body }),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('toolbar-rotate-btn').click();
    const shoreImg = page.locator('[data-ground-tile="2_2"]');
    const shoreBtn = page.locator('button[aria-label*="(2, 2)"]');
    await shoreBtn.click({ force: true });

    // Under reducedMotion, swap happens immediately (not delayed 90ms)
    await expect(shoreImg).toHaveAttribute('src', /basic-block-wather-grass-50-50-r1\.png/);
    const animName = await shoreImg.evaluate(
      (el) => getComputedStyle(el.parentElement!).animationName,
    );
    expect(animName).not.toContain('rt-rot4-pulse');
  });
});
