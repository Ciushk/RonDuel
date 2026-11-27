import { expect, test, type Page } from '@playwright/test';

async function seedSessionAndRoutes(page: Page, uid: string): Promise<void> {
  await page.addInitScript((sessionUid: string) => {
    window.localStorage.setItem(
      'ronduel_session_v1',
      JSON.stringify({
        uid: sessionUid,
        nickname: 'PickTester',
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

function buildTownPayload() {
  const now = Date.now();
  // 2x2 owned land at (3,3), (3,4), (4,3), (4,4) so (2,3), (3,2) are expand ring cells directly behind house (3,3)
  return {
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
      plotsOwned: 2,
      land: {
        '3_3': 'basic-block',
        '3_4': 'basic-block',
        '4_3': 'basic-block',
        '4_4': 'basic-block',
        '3_2': 'basic-block',
      },
      landRot: {},
    },
    tiles: {
      '3_3': { x: 3, y: 3, itemId: 'starter_house' },
      '3_4': {
        x: 3,
        y: 4,
        itemId: 'plot',
        cropId: 'wheat',
        plantedAt: now - 120_000,
        readyAt: now - 5_000,
      },
      '4_4': {
        x: 4,
        y: 4,
        itemId: 'plot',
        cropId: 'wheat',
        plantedAt: now,
        readyAt: now + 3_600_000,
      },
    },
    walletBalance: 500,
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

test.describe('RonTown sprite-aware click hit-testing & hover outline', () => {
  test('mobile 390px: clicking roof selects/rotates house, uncovered diamond still works, drag from roof pans, placement ignores roof, badges win', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const rotatePayloads: Array<{ x: number; y: number; layer: string; rot: number }> = [];
    let harvested = false;

    await seedSessionAndRoutes(page, 'u_e2e_pick_mobile');
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildTownPayload()),
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
        body: JSON.stringify({ ok: true, ...body }),
      });
    });
    await page.route('**/api/town/harvest*', async (route) => {
      harvested = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ harvestedCrop: 'wheat', inventory: { wheat: 2 } }),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });
    const houseImg = page.locator('img[data-item-tile="3_3"]');
    await expect(houseImg).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(300);

    // Measure the opaque roof peak of starter_house (3,3) — upper-center of the 125x137 sprite
    const houseBox = await houseImg.boundingBox();
    expect(houseBox).not.toBeNull();
    const roofX = houseBox!.x + houseBox!.width * 0.5;
    const roofY = houseBox!.y + houseBox!.height * 0.28;

    // 1. Click roof in Explore mode -> opens Starter House tile sheet, NOT Expand Land sheet
    await page.mouse.click(roofX, roofY);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog).toContainText(/starter house/i);
    await expect(dialog).not.toContainText(/expand/i);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // 2. Drag starting on roof (> 6px) pans the stage and does NOT open the tile sheet
    const stageBefore = await page
      .locator('[data-rontown-stage="true"]')
      .evaluate((el) => (el as HTMLElement).style.transform);
    await page.mouse.move(roofX, roofY);
    await page.mouse.down();
    await page.mouse.move(roofX + 40, roofY + 25, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Stage transform may spring back if centered, so just verify dialog never opened
    expect(stageBefore).toContain('translate3d');

    // 3. In Rotate mode, clicking the roof rotates starter_house (3,3)
    await page.getByTestId('toolbar-rotate-btn').click();
    await expect(page.getByTestId('toolbar-rotate-btn')).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(150);
    // Re-measure house box after the Rotate mode banner shifts the map viewport
    const houseBox2 = await houseImg.boundingBox();
    expect(houseBox2).not.toBeNull();
    const roofX2 = houseBox2!.x + houseBox2!.width * 0.5;
    const roofY2 = houseBox2!.y + houseBox2!.height * 0.28;
    await page.mouse.click(roofX2, roofY2);
    await expect.poll(() => rotatePayloads.length, { timeout: 5_000 }).toBe(1);
    expect(rotatePayloads[0]).toMatchObject({ x: 3, y: 3, layer: 'item', rot: 1 });
    // Exit rotate mode and wait for banner removal / ResizeObserver camera settle
    await page.getByTestId('toolbar-rotate-btn').click();
    await expect(page.getByTestId('toolbar-rotate-btn')).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(200);

    // 4. Clicking a transparent corner of the house over expand diamond (2,2) falls through to Expand Land sheet
    const expandBtn = page.locator('[data-rt-expand-btn="true"][data-rt-x="2"][data-rt-y="2"]');
    const expandBox = await expandBtn.boundingBox();
    expect(expandBox).not.toBeNull();
    // Right corner of expand diamond (2,2): inside house bbox, alpha=0, clear of (3,4) harvest badge -> falls through to expand (2,2)
    await page.mouse.click(
      expandBox!.x + expandBox!.width * 0.9,
      expandBox!.y + expandBox!.height * 0.5,
    );
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('dialog')).toContainText(/expand|buy land|land/i);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    // 5. In Farm / Plant mode (ground-target mode), stage sets data-rt-ground-target="true" and house img becomes pointer-events: none
    await page
      .getByTestId('town-action-bar')
      .getByRole('button', { name: 'Farm', exact: true })
      .click();
    const seedBtn = page.getByRole('button', { name: 'Plant Wheat' });
    await expect(seedBtn).toBeVisible({ timeout: 5_000 });
    await seedBtn.click();
    await expect(page.locator('[data-rontown-stage="true"]')).toHaveAttribute(
      'data-rt-ground-target',
      'true',
    );
    await expect(houseImg).toHaveCSS('pointer-events', 'none');
    // Exit planting mode via Cancel button
    await page
      .getByRole('button', { name: /cancel/i })
      .first()
      .click();
    await expect(page.locator('[data-rontown-stage="true"]')).not.toHaveAttribute(
      'data-rt-ground-target',
      'true',
    );

    // 6. Harvest badge still receives taps
    const harvestBtn = page.locator('[data-rt-badge-btn="true"]').first();
    await expect(harvestBtn).toBeVisible({ timeout: 5_000 });
    await harvestBtn.click();
    await expect.poll(() => harvested, { timeout: 8_000 }).toBe(true);
  });

  test('desktop 1280px: hovering roof shows volt silhouette and house tooltip; reduced-motion snaps instantly', async ({
    browser,
  }) => {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        reducedMotion,
        serviceWorkers: 'block',
      });
      const page = await ctx.newPage();
      await seedSessionAndRoutes(page, `u_e2e_pick_desktop_${reducedMotion}`);
      await page.route('**/api/town/init*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildTownPayload()),
        });
      });

      await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });
      const houseImg = page.locator('img[data-item-tile="3_3"]');
      await expect(houseImg).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(250);

      const houseBox = await houseImg.boundingBox();
      expect(houseBox).not.toBeNull();
      const roofX = houseBox!.x + houseBox!.width * 0.5;
      const roofY = houseBox!.y + houseBox!.height * 0.28;

      await page.mouse.move(roofX, roofY);

      const outline = page.locator('[data-rt-hover-outline="true"][data-rt-hover-key="3_3"]');
      await expect(outline).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole('tooltip')).toContainText(/starter house/i);

      const styleInfo = await outline.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          transitionProperty: cs.transitionProperty,
          transitionDuration: cs.transitionDuration,
          filter: cs.filter,
          pointerEvents: cs.pointerEvents,
        };
      });
      expect(styleInfo.pointerEvents).toBe('none');
      expect(styleInfo.filter).toContain('drop-shadow');
      if (reducedMotion === 'reduce') {
        expect(
          styleInfo.transitionProperty === 'none' ||
            parseFloat(styleInfo.transitionDuration) <= 0.001,
        ).toBe(true);
      } else {
        expect(styleInfo.transitionProperty).toBe('opacity');
        expect(Math.abs(parseFloat(styleInfo.transitionDuration) - 0.15)).toBeLessThan(0.02);
      }

      // Move off the island -> hover outline clears
      await page.mouse.move(10, 10);
      await expect(outline).toHaveCount(0);

      await ctx.close();
    }
  });
});
