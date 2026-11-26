import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const SHOTS_DIR = process.env.RONTOWN_SHOTS_DIR || '';
const TEST_UID = 'u_e2e_roads_1';

function shotPath(name: string): string | null {
  return SHOTS_DIR ? path.join(SHOTS_DIR, name) : null;
}

function buildGrassGrid(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): Record<string, string> {
  const land: Record<string, string> = {};
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      land[`${x}_${y}`] = 'basic-block';
    }
  }
  return land;
}

async function seedSessionAndRoutes(page: Page, uid = TEST_UID): Promise<void> {
  await page.addInitScript((sessionUid: string) => {
    window.localStorage.setItem(
      'ronduel_session_v1',
      JSON.stringify({
        uid: sessionUid,
        nickname: 'RoadTester',
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

test.describe('RonTown Roads (16-way auto-tiling + preview + optional rotate)', () => {
  const roadNetworkPayload = {
    town: {
      gridSize: 8,
      population: 2,
      housingCapacity: 4,
      serviceCapacity: 4,
      populationCap: 4,
      level: 2,
      maxLevelReached: 2,
      tutorialStep: 3,
      likesCount: 0,
      plotsOwned: 1,
      land: buildGrassGrid(0, 6, 0, 6),
    },
    tiles: {
      '0_0': { x: 0, y: 0, itemId: 'starter_house' },
      // 4-way cross at (2,2) with dead ends at (2,1) [S] and (1,2) [E]
      '2_2': { x: 2, y: 2, itemId: 'road' },
      '2_1': { x: 2, y: 1, itemId: 'road' },
      '1_2': { x: 1, y: 2, itemId: 'road' },
      '3_2': { x: 3, y: 2, itemId: 'road' },
      '2_3': { x: 2, y: 3, itemId: 'road' },
      // Loop + T-junction (N+E+S) at (4,3) + dead end (W) at (5,3) + NW curve at (4,4) + NE curve at (2,4) + SW curve at (4,2)
      '4_2': { x: 4, y: 2, itemId: 'road' },
      '4_3': { x: 4, y: 3, itemId: 'road' },
      '5_3': { x: 5, y: 3, itemId: 'road' },
      '4_4': { x: 4, y: 4, itemId: 'road' },
      '3_4': { x: 3, y: 4, itemId: 'road' },
      '2_4': { x: 2, y: 4, itemId: 'road' },
      // Separate L-shape showcasing SE curve at (0,5) + dead ends (W) at (1,5) and (N) at (0,6)
      '0_5': { x: 0, y: 5, itemId: 'road' },
      '1_5': { x: 1, y: 5, itemId: 'road' },
      '0_6': { x: 0, y: 6, itemId: 'road' },
      // Isolated rotated road (rot: 1 -> E-W flipX) at (6,1) and isolated default (N-S) at (6,5)
      '6_1': { x: 6, y: 1, itemId: 'road', rot: 1 },
      '6_5': { x: 6, y: 5, itemId: 'road' },
    },
    walletBalance: 500,
    inventory: {},
    orders: [],
    ordersUnlocked: true,
  };

  test('renders exact sprites for L curves, T junction, 4-way cross, dead ends, and isolated rot 0/1', async ({
    page,
  }) => {
    await seedSessionAndRoutes(page, 'u_roads_network');
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(roadNetworkPayload),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-road-tile="2_2"]')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(300);

    const roadMap = await page.evaluate(() => {
      const out: Record<string, { src: string; transform: string; zIndex: number }> = {};
      document.querySelectorAll<HTMLImageElement>('[data-road-tile]').forEach((img) => {
        const key = img.getAttribute('data-road-tile')!;
        out[key] = {
          src: img.getAttribute('src') || '',
          transform: img.style.transform || '',
          zIndex: Number(window.getComputedStyle(img).zIndex),
        };
      });
      return out;
    });

    // Cross
    expect(roadMap['2_2']?.src).toContain('basic-block-intersection.png');
    // Curves in all 4 orientations
    expect(roadMap['2_4']?.src).toContain('basic-block-street-curve.png');
    expect(roadMap['2_4']?.transform).toBe('');
    expect(roadMap['4_2']?.src).toContain('basic-block-street-curve.png');
    expect(roadMap['4_2']?.transform).toContain('scaleX(-1)');
    expect(roadMap['4_4']?.src).toContain('basic-block-street-curve-nw.png');
    expect(roadMap['0_5']?.src).toContain('basic-block-street-curve-se.png');
    // T-junction (never intersection)
    expect(roadMap['4_3']?.src).toContain('basic-block-street-t-nes.png');
    expect(roadMap['4_3']?.src).not.toContain('intersection');
    // All 4 dead-end caps (never intersection)
    expect(roadMap['0_6']?.src).toContain('basic-block-street-end-n.png');
    expect(roadMap['1_2']?.src).toContain('basic-block-street-end-e.png');
    expect(roadMap['2_1']?.src).toContain('basic-block-street-end-s.png');
    expect(roadMap['5_3']?.src).toContain('basic-block-street-end-w.png');
    expect(roadMap['1_5']?.src).toContain('basic-block-street-end-w.png');
    for (const deadEnd of ['0_6', '1_2', '2_1', '5_3', '1_5']) {
      expect(roadMap[deadEnd]?.src).not.toContain('intersection');
    }
    // Isolated tiles (rot=1 vs default)
    expect(roadMap['6_1']?.src).toContain('basic-block-street.png');
    expect(roadMap['6_1']?.transform).toContain('scaleX(-1)');
    expect(roadMap['6_5']?.src).toContain('basic-block-street.png');
    expect(roadMap['6_5']?.transform).toBe('');

    const out = shotPath('rontown_roads_390.png');
    if (out) await page.screenshot({ path: out });
  });

  test('road placement preview re-resolves neighbours, supports Rotate button + R shortcut + aria-live, and sends rot', async ({
    page,
  }) => {
    await seedSessionAndRoutes(page, 'u_roads_rotate');
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(roadNetworkPayload),
      });
    });

    const buildRequests: Array<Record<string, unknown>> = [];
    await page.route('**/api/town/build*', async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      buildRequests.push(body);
      // Simulate an older server that omits `rot` in its response to verify client tolerance
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          town: roadNetworkPayload.town,
          tile: { itemId: body.itemId, x: body.x, y: body.y },
        }),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });

    // Open Build -> Decor -> Build Cobblestone Road
    await page.getByRole('button', { name: 'Build' }).first().click();
    await page.getByRole('button', { name: 'Decor' }).click();
    const roadCard = page.locator('div', { hasText: 'Cobblestone Road' }).filter({
      has: page.getByRole('button', { name: 'Build' }),
    });
    await roadCard.last().getByRole('button', { name: 'Build' }).click();

    // Rotate button is visible, >= 44x44px, properly labeled, aria-pressed="false"
    const rotateBtn = page.getByTestId('road-rotate-btn');
    await expect(rotateBtn).toBeVisible({ timeout: 5_000 });
    await expect(rotateBtn).toHaveAttribute('aria-label', 'Rotate road');
    await expect(rotateBtn).toHaveAttribute('aria-pressed', 'false');
    const box = await rotateBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // Focus a truly isolated empty cell (4, 0) to trigger the road preview
    const isolatedCellBtn = page
      .locator('[data-rontown-stage="true"] button[aria-label*="4, 0"]')
      .first();
    await isolatedCellBtn.focus();

    const preview = page.locator('[data-road-preview="true"]');
    await expect(preview).toBeVisible({ timeout: 5_000 });
    await expect(preview).toHaveAttribute('src', /basic-block-street\.png/);
    expect(await preview.evaluate((el) => el.style.transform)).toBe('scaleX(1)');

    // Click Rotate -> preview stays visible, aria-pressed="true", aria-live announces East-West, preview flips to scaleX(-1)
    await rotateBtn.click();
    await expect(rotateBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('road-axis-live')).toContainText('East–West');
    await expect(preview).toBeVisible();
    expect(await preview.evaluate((el) => el.style.transform)).toBe('scaleX(-1)');

    // Press R shortcut -> toggles back to North-South
    await page.keyboard.press('r');
    await expect(rotateBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('road-axis-live')).toContainText('North–South');
    expect(await preview.evaluate((el) => el.style.transform)).toBe('scaleX(1)');

    // Focus adjacent to dead-end (2, 1) at (2, 0) -> neighbour (2, 1) re-resolves from end-s to straight street!
    const northOfEndBtn = page
      .locator('[data-rontown-stage="true"] button[aria-label*="2, 0"]')
      .first();
    await northOfEndBtn.focus();
    await expect(page.locator('[data-road-tile="2_1"]')).toHaveAttribute(
      'src',
      /basic-block-street\.png/,
    );
    await expect(preview).toHaveAttribute('src', /basic-block-street-end-s\.png/);

    // Now rotate to rot=1 and place on isolated cell (4, 0)
    await isolatedCellBtn.focus();
    await rotateBtn.click();
    await expect(rotateBtn).toHaveAttribute('aria-pressed', 'true');
    await isolatedCellBtn.click();

    await expect.poll(() => buildRequests.length, { timeout: 5_000 }).toBe(1);
    expect(buildRequests[0]).toMatchObject({ itemId: 'road', x: 4, y: 0, rot: 1 });

    // Even though mocked server omitted `rot`, client preserves scaleX(-1) on placed tile 4_0
    const placedRoad = page.locator('[data-road-tile="4_0"]');
    await expect(placedRoad).toBeVisible({ timeout: 5_000 });
    expect(await placedRoad.evaluate((el) => el.style.transform)).toContain('scaleX(-1)');
  });

  test('reduced-motion disables scaleX transform transition on road preview', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await ctx.newPage();
    await seedSessionAndRoutes(page, 'u_roads_rm');
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(roadNetworkPayload),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Build' }).first().click();
    await page.getByRole('button', { name: 'Decor' }).click();
    const roadCard = page.locator('div', { hasText: 'Cobblestone Road' }).filter({
      has: page.getByRole('button', { name: 'Build' }),
    });
    await roadCard.last().getByRole('button', { name: 'Build' }).click();

    await page.locator('[data-rontown-stage="true"] button[aria-label*="4, 0"]').first().focus();
    const preview = page.locator('[data-road-preview="true"]');
    await expect(preview).toBeVisible({ timeout: 5_000 });

    await page.getByTestId('road-rotate-btn').click();
    await expect(preview).toBeVisible();
    const cs = await preview.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        transitionProperty: s.transitionProperty,
        transitionDuration: s.transitionDuration,
        transform: el.style.transform,
      };
    });
    expect(cs.transform).toBe('scaleX(-1)');
    expect(cs.transitionProperty === 'none' || parseFloat(cs.transitionDuration) <= 0.001).toBe(
      true,
    );
    await ctx.close();
  });
});
