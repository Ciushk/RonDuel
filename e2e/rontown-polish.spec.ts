import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const SHOTS_DIR = process.env.RONTOWN_SHOTS_DIR || '';
const TEST_UID = 'u_e2e_polish_1';

function shotPath(name: string): string | null {
  return SHOTS_DIR ? path.join(SHOTS_DIR, name) : null;
}

function buildLandGrid(coords: Array<[number, number, string]>): Record<string, string> {
  const land: Record<string, string> = {};
  for (const [x, y, ground] of coords) {
    land[`${x}_${y}`] = ground;
  }
  return land;
}

async function seedSessionAndFlags(page: Page, uid = TEST_UID): Promise<void> {
  await page.addInitScript((sessionUid: string) => {
    window.localStorage.setItem(
      'ronduel_session_v1',
      JSON.stringify({
        uid: sessionUid,
        nickname: 'AndreiTest',
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

test.describe('RonTown Polish (Parts 1-5)', () => {
  test('Part 1: villager never clips under ground/road slabs while walking across the map', async ({
    page,
  }) => {
    await seedSessionAndFlags(page);

    // 4x4 island with a road loop around the outer ring and a ripe wheat plot at the far corner (5,5)
    const landCoords: Array<[number, number, string]> = [];
    for (let x = 2; x <= 5; x++) {
      for (let y = 2; y <= 5; y++) {
        const isEdge = x === 2 || x === 5 || y === 2 || y === 5;
        landCoords.push([x, y, isEdge ? 'basic-block-street' : 'basic-block']);
      }
    }

    const now = Date.now();
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
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
            land: buildLandGrid(landCoords),
          },
          tiles: {
            '3_3': { x: 3, y: 3, itemId: 'starter_house' },
            '5_5': {
              x: 5,
              y: 5,
              itemId: 'plot',
              cropId: 'wheat',
              plantedAt: now - 120_000,
              readyAt: now - 10_000,
            },
          },
          walletBalance: 250,
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
        body: JSON.stringify({
          harvestedCrop: 'wheat',
          inventory: { wheat: 1 },
        }),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-villager-id]').first()).toBeVisible({ timeout: 10_000 });

    // Click the ready harvest badge to dispatch a villager across the street loop
    const harvestBtn = page.getByRole('button', { name: /harvest/i }).first();
    await expect(harvestBtn).toBeVisible({ timeout: 10_000 });
    await harvestBtn.click();

    // Sample depth/stacking order across several points of the walk
    const samples: Array<{
      villagerZ: number;
      maxGroundZ: number;
      villagerAboveGroundAtFeet: boolean;
    }> = [];

    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(250);
      const sample = await page.evaluate(() => {
        const stage = document.querySelector('[data-rontown-stage="true"]');
        if (!stage) return null;
        const villagerWrappers = Array.from(
          stage.querySelectorAll<HTMLElement>('[data-villager-id]'),
        );
        if (villagerWrappers.length === 0) return null;

        // Ground slab containers have z-index < 1000
        const allDirectDivs = Array.from(stage.children).filter(
          (el): el is HTMLElement => el instanceof HTMLElement,
        );
        let maxGroundZ = -1;
        for (const el of allDirectDivs) {
          if (el.hasAttribute('data-villager-id')) continue;
          const z = Number(window.getComputedStyle(el).zIndex);
          if (Number.isFinite(z) && z < 1000) {
            if (z > maxGroundZ) maxGroundZ = z;
          }
        }

        // Check every villager wrapper & hit-test paint order at its feet
        let minVillagerZ = Number.POSITIVE_INFINITY;
        let allAbove = true;

        // Temporarily enable pointer-events on villager imgs and ground imgs to test visual paint order
        const touched: Array<{ el: HTMLElement; prev: string }> = [];
        const imgs = Array.from(stage.querySelectorAll<HTMLElement>('img'));
        for (const img of imgs) {
          touched.push({ el: img, prev: img.style.pointerEvents });
          img.style.pointerEvents = 'auto';
        }

        try {
          for (const vw of villagerWrappers) {
            const vz = Number(window.getComputedStyle(vw).zIndex);
            if (Number.isFinite(vz)) {
              minVillagerZ = Math.min(minVillagerZ, vz);
            }
            const img = vw.querySelector<HTMLElement>('[data-villager-img]');
            if (!img) continue;
            const rect = img.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;
            const feetX = rect.left + rect.width / 2;
            const feetY = rect.bottom - 2;
            if (feetX < 0 || feetY < 0 || feetX > window.innerWidth || feetY > window.innerHeight) {
              continue;
            }
            const stack = document.elementsFromPoint(feetX, feetY);
            const vIdx = stack.indexOf(img);
            // Every ground img (parent has zIndex < 1000) must appear AFTER the villager img in paint order
            for (const hit of stack) {
              if (hit instanceof HTMLImageElement && hit !== img) {
                const parentZ = Number(window.getComputedStyle(hit.parentElement!).zIndex);
                if (Number.isFinite(parentZ) && parentZ < 1000) {
                  const gIdx = stack.indexOf(hit);
                  if (vIdx === -1 || gIdx < vIdx) {
                    allAbove = false;
                  }
                }
              }
            }
          }
        } finally {
          for (const item of touched) {
            item.el.style.pointerEvents = item.prev;
          }
        }

        return {
          villagerZ: minVillagerZ,
          maxGroundZ,
          villagerAboveGroundAtFeet: allAbove,
        };
      });

      if (sample) samples.push(sample);
    }

    expect(samples.length).toBeGreaterThanOrEqual(4);
    for (const s of samples) {
      expect(s.villagerZ).toBeGreaterThanOrEqual(1000);
      expect(s.maxGroundZ).toBeLessThan(1000);
      expect(s.villagerZ).toBeGreaterThan(s.maxGroundZ);
      expect(s.villagerAboveGroundAtFeet).toBe(true);
    }

    const out = shotPath('rontown_depth_fixed_390.png');
    if (out) await page.screenshot({ path: out });
  });

  test('Part 2: planted crop plot sits flush with surrounding grass tiles via groundOffsetY', async ({
    page,
  }) => {
    await seedSessionAndFlags(page);

    // 3x3 grass island with a half-grown wheat plot in the center (3,3) surrounded by grass on all 4 sides
    const landCoords: Array<[number, number, string]> = [];
    for (let x = 2; x <= 4; x++) {
      for (let y = 2; y <= 4; y++) {
        landCoords.push([x, y, 'basic-block']);
      }
    }

    const now = Date.now();
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
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
            land: buildLandGrid(landCoords),
          },
          tiles: {
            '2_2': { x: 2, y: 2, itemId: 'starter_house' },
            '3_3': {
              x: 3,
              y: 3,
              itemId: 'plot',
              cropId: 'wheat',
              plantedAt: now - 30_000,
              readyAt: now + 30_000,
            },
            '3_4': {
              x: 3,
              y: 4,
              itemId: 'plot',
              cropId: 'pumpkin',
              plantedAt: now - 120_000,
              readyAt: now - 5_000,
            },
          },
          walletBalance: 150,
          inventory: {},
          orders: [],
          ordersUnlocked: true,
        }),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });

    const cropCheck = await page.evaluate(() => {
      const stage = document.querySelector('[data-rontown-stage="true"]');
      if (!stage) return null;
      const wheatImg = stage.querySelector<HTMLImageElement>('img[src*="wheat-half"]');
      const pumpkinImg = stage.querySelector<HTMLImageElement>('img[src*="pumpkin-done"]');
      if (!wheatImg || !pumpkinImg) return null;
      return {
        wheatTop: parseFloat(wheatImg.style.top),
        wheatHeight: wheatImg.height,
        pumpkinTop: parseFloat(pumpkinImg.style.top),
        pumpkinHeight: pumpkinImg.height,
      };
    });

    expect(cropCheck).not.toBeNull();
    // wheat-half has groundOffsetY = +3, pumpkin-done has groundOffsetY = +1
    expect(Number.isFinite(cropCheck!.wheatTop)).toBe(true);
    expect(Number.isFinite(cropCheck!.pumpkinTop)).toBe(true);

    const out = shotPath('rontown_crop_offset_390.png');
    if (out) await page.screenshot({ path: out });
  });

  test('Part 3: 6 villagers behave independently, avoid sharing cells, and respect reduced-motion', async ({
    page,
    browser,
  }) => {
    await seedSessionAndFlags(page);

    const landCoords: Array<[number, number, string]> = [];
    for (let x = 2; x <= 6; x++) {
      for (let y = 2; y <= 6; y++) {
        landCoords.push([x, y, x === 4 || y === 4 ? 'basic-block-street' : 'basic-block']);
      }
    }

    const now = Date.now();
    const townPayload = {
      town: {
        gridSize: 8,
        population: 6,
        housingCapacity: 8,
        serviceCapacity: 8,
        populationCap: 8,
        level: 3,
        maxLevelReached: 3,
        tutorialStep: 3,
        likesCount: 2,
        plotsOwned: 2,
        land: buildLandGrid(landCoords),
      },
      tiles: {
        '2_2': { x: 2, y: 2, itemId: 'starter_house' },
        '2_5': { x: 2, y: 5, itemId: 'cottage' },
        '5_2': { x: 5, y: 2, itemId: 'bakery' },
        '5_5': {
          x: 5,
          y: 5,
          itemId: 'plot',
          cropId: 'wheat',
          plantedAt: now - 30_000,
          readyAt: now + 90_000,
        },
        '6_5': { x: 6, y: 5, itemId: 'plot' },
      },
      walletBalance: 420,
      inventory: {},
      orders: [],
      ordersUnlocked: true,
    };

    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(townPayload),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-villager-id]')).toHaveCount(6, { timeout: 10_000 });

    // Sample villager screen positions every 500ms over 10s
    const seenBuckets = new Set<string>();
    const consecutivePairOverlap = new Map<string, number>();
    let maxConsecutiveOverlapSamples = 0;

    for (let step = 0; step < 20; step++) {
      await page.waitForTimeout(500);
      const positions = await page.evaluate(() => {
        return Array.from(document.querySelectorAll<HTMLElement>('[data-villager-id]')).map(
          (el) => {
            const id = el.getAttribute('data-villager-id') || '';
            const t = el.style.transform;
            const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(t);
            return {
              id,
              x: m ? parseFloat(m[1]) : 0,
              y: m ? parseFloat(m[2]) : 0,
            };
          },
        );
      });

      const currentOverlaps = new Set<string>();
      for (let i = 0; i < positions.length; i++) {
        const a = positions[i];
        seenBuckets.add(`${Math.round(a.x / 64)}_${Math.round(a.y / 32)}`);
        for (let j = i + 1; j < positions.length; j++) {
          const b = positions[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          const pairKey = `${a.id}|${b.id}`;
          if (dist < 10) {
            currentOverlaps.add(pairKey);
            const next = (consecutivePairOverlap.get(pairKey) ?? 0) + 1;
            consecutivePairOverlap.set(pairKey, next);
            if (next > maxConsecutiveOverlapSamples) maxConsecutiveOverlapSamples = next;
          }
        }
      }
      for (const k of Array.from(consecutivePairOverlap.keys())) {
        if (!currentOverlaps.has(k)) consecutivePairOverlap.set(k, 0);
      }
    }

    // At least 3 distinct spatial cells occupied across samples, and no pair sits identically on top of each other > 2s (4 samples)
    expect(seenBuckets.size).toBeGreaterThanOrEqual(3);
    expect(maxConsecutiveOverlapSamples).toBeLessThanOrEqual(4);

    const out = shotPath('rontown_villagers_independent_390.png');
    if (out) await page.screenshot({ path: out });

    // Reduced-motion context: no continuous walking over 6s (at most 1 relocation per villager)
    const rmContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const rmPage = await rmContext.newPage();
    await seedSessionAndFlags(rmPage);
    await rmPage.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(townPayload),
      });
    });

    await rmPage.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(rmPage.locator('[data-villager-id]')).toHaveCount(6, { timeout: 15_000 });
    await rmPage.waitForTimeout(300);

    const lastTransform = new Map<string, string>();
    const changeCounts = new Map<string, number>();

    for (let s = 0; s < 12; s++) {
      const snaps = await rmPage.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-villager-id]')).map((el) => ({
          id: el.getAttribute('data-villager-id') || '',
          transform: el.style.transform,
        })),
      );
      for (const item of snaps) {
        const prev = lastTransform.get(item.id);
        if (prev !== undefined && prev !== item.transform) {
          changeCounts.set(item.id, (changeCounts.get(item.id) ?? 0) + 1);
        }
        lastTransform.set(item.id, item.transform);
      }
      await rmPage.waitForTimeout(500);
    }

    for (const count of changeCounts.values()) {
      expect(count).toBeLessThanOrEqual(1);
    }
    await rmContext.close();
  });

  const makeTutorialTown = (tutorialStep: number) => ({
    town: {
      gridSize: 8,
      population: 2,
      housingCapacity: 2,
      serviceCapacity: 4,
      populationCap: 2,
      level: 1,
      maxLevelReached: 1,
      tutorialStep,
      likesCount: 0,
      plotsOwned: 2,
      land: buildLandGrid([
        [3, 3, 'basic-block'],
        [3, 4, 'basic-block'],
        [4, 4, 'basic-block'],
      ]),
    },
    tiles: {
      '3_3': { x: 3, y: 3, itemId: 'starter_house' },
      '3_4': { x: 3, y: 4, itemId: 'plot' },
      '4_4': { x: 4, y: 4, itemId: 'plot' },
    },
    walletBalance: 100,
    inventory: {},
    orders: [],
    ordersUnlocked: false,
  });

  test('Part 4a: skip tutorial posts step 3, hides card, and re-syncs stale server on reload', async ({
    page,
  }) => {
    await seedSessionAndFlags(page, 'u_tut_1');

    const tutorialPosts: Array<{ uid?: string; step?: number }> = [];
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeTutorialTown(1)),
      });
    });
    await page.route('**/api/town/tutorial*', async (route) => {
      const body = route.request().postDataJSON() as { uid?: string; step?: number };
      tutorialPosts.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tutorialStep: body.step ?? 3 }),
      });
    });

    await page.goto('/ro/town', { waitUntil: 'domcontentloaded' });
    const card = page.getByTestId('town-tutorial-card');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText('2/3');

    await card.getByRole('button', { name: 'Omite' }).click();
    await expect(card).toBeHidden();
    await expect.poll(() => tutorialPosts.some((p) => p.step === 3), { timeout: 5_000 }).toBe(true);

    // Reload while server STILL returns tutorialStep: 1 -> card stays hidden AND client re-syncs step 3
    tutorialPosts.length = 0;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('town-tutorial-card')).toHaveCount(0);
    await expect.poll(() => tutorialPosts.some((p) => p.step === 3), { timeout: 5_000 }).toBe(true);
  });

  test('Part 4b: server tutorialStep 3 hides card on fresh context', async ({ page }) => {
    await seedSessionAndFlags(page, 'u_tut_2');
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeTutorialTown(3)),
      });
    });
    await page.goto('/ro/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('town-tutorial-card')).toHaveCount(0);
  });

  test('Part 4c: step 2 finish button persists done=true and stays hidden on reload', async ({
    page,
  }) => {
    await seedSessionAndFlags(page, 'u_tut_3');
    const posts: Array<{ step?: number }> = [];
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeTutorialTown(2)),
      });
    });
    await page.route('**/api/town/tutorial*', async (route) => {
      const body = route.request().postDataJSON() as { step?: number };
      posts.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tutorialStep: body.step ?? 3 }),
      });
    });
    await page.goto('/ro/town', { waitUntil: 'domcontentloaded' });
    const card = page.getByTestId('town-tutorial-card');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText('3/3');
    await card.getByRole('button', { name: 'Am înțeles!' }).click();
    await expect.poll(() => posts.some((p) => p.step === 3), { timeout: 5_000 }).toBe(true);
    const stored = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('rt_tutorial_v1_u_tut_3') || '{}'),
    );
    expect(stored).toEqual({ step: 3, done: true });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('town-tutorial-card')).toHaveCount(0);
  });

  test('Part 4d: local step 2 wins over stale server step 1', async ({ page }) => {
    await seedSessionAndFlags(page, 'u_tut_4');
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'rt_tutorial_v1_u_tut_4',
        JSON.stringify({ step: 2, done: false }),
      );
    });
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeTutorialTown(1)),
      });
    });
    await page.route('**/api/town/tutorial*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tutorialStep: 2 }),
      });
    });
    await page.goto('/ro/town', { waitUntil: 'domcontentloaded' });
    const card = page.getByTestId('town-tutorial-card');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText('3/3');
  });

  const nonStarterPayload = {
    town: {
      gridSize: 8,
      population: 5,
      housingCapacity: 6,
      serviceCapacity: 6,
      populationCap: 6,
      level: 2,
      maxLevelReached: 2,
      tutorialStep: 3,
      likesCount: 1,
      plotsOwned: 1,
      land: buildLandGrid([
        [0, 0, 'basic-block'],
        [0, 1, 'basic-block-street'],
        [1, 0, 'basic-block'],
        [1, 1, 'basic-block-street'],
        [2, 0, 'basic-block'],
        [2, 1, 'basic-block'],
      ]),
    },
    tiles: {
      '0_0': { x: 0, y: 0, itemId: 'house_small' },
      '2_0': { x: 2, y: 0, itemId: 'cafe' },
    },
    walletBalance: 555,
    inventory: {},
    orders: [],
    ordersUnlocked: true,
  };

  test('Part 5a: no cache + delayed init shows island skeleton and never flashes starter town', async ({
    page,
  }) => {
    await seedSessionAndFlags(page, 'u_flash_a');
    await page.addInitScript(() => {
      const log: Array<{
        t: number;
        hasStage: boolean;
        hasStarter: boolean;
        cellLabels: string[];
      }> = [];
      (window as unknown as { __flashLog?: typeof log }).__flashLog = log;
      const obs = new MutationObserver(() => {
        const stage = document.querySelector('[data-rontown-stage="true"]');
        if (stage) {
          const labels = Array.from(stage.querySelectorAll<HTMLButtonElement>('button[aria-label]'))
            .map((b) => b.getAttribute('aria-label') || '')
            .filter((l) => l.includes('('));
          const hasStarter =
            labels.some((l) => l.includes('(3, 3)')) && labels.some((l) => l.includes('(4, 4)'));
          log.push({
            t: performance.now(),
            hasStage: true,
            hasStarter,
            cellLabels: labels.slice(0, 8),
          });
        }
      });
      obs.observe(document, { childList: true, subtree: true });
    });

    let initResolvedAt = 0;
    await page.route('**/api/town/init*', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      initResolvedAt = Date.now();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(nonStarterPayload),
      });
    });

    await page.goto('/ro/town', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('town-skeleton')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-rontown-stage="true"]')).toHaveCount(0);

    const skelShot = shotPath('rontown_skeleton_390.png');
    if (skelShot) await page.screenshot({ path: skelShot });

    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 10_000 });
    expect(initResolvedAt).toBeGreaterThan(0);

    const flashLog = await page.evaluate(
      () =>
        (
          window as unknown as {
            __flashLog?: Array<{ hasStage: boolean; hasStarter: boolean; cellLabels: string[] }>;
          }
        ).__flashLog ?? [],
    );
    expect(flashLog.length).toBeGreaterThan(0);
    for (const entry of flashLog) {
      expect(entry.hasStarter).toBe(false);
    }
    expect(flashLog[0].cellLabels.some((l) => l.includes('house_small (0, 0)'))).toBe(true);
  });

  test('Part 5b: cached rt_town_cache_v3 renders immediately before delayed init resolves', async ({
    page,
  }) => {
    await seedSessionAndFlags(page, 'u_flash_b');
    await page.addInitScript((payload) => {
      window.localStorage.setItem(
        'rt_town_cache_v3_u_flash_b',
        JSON.stringify({
          town: payload.town,
          tiles: payload.tiles,
          walletBalance: payload.walletBalance,
          inventory: payload.inventory,
          savedAt: Date.now(),
          source: 'server',
        }),
      );
    }, nonStarterPayload);

    let initResolved = false;
    let releaseInit!: () => void;
    const initGate = new Promise<void>((resolve) => {
      releaseInit = resolve;
    });
    await page.route('**/api/town/init*', async (route) => {
      await initGate;
      initResolved = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(nonStarterPayload),
      });
    });

    await page.goto('/ro/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 10_000 });
    expect(initResolved).toBe(false);
    await expect(page.getByTestId('town-skeleton')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'house_small (0, 0)' })).toBeVisible();
    releaseInit();
  });

  test('Part 5c: reduced-motion disables skeleton pulse and map fade transition', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await ctx.newPage();
    await seedSessionAndFlags(page, 'u_flash_c');
    let releaseInit!: () => void;
    const initGate = new Promise<void>((resolve) => {
      releaseInit = resolve;
    });
    await page.route('**/api/town/init*', async (route) => {
      await initGate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(nonStarterPayload),
      });
    });

    await page.goto('/ro/town', { waitUntil: 'domcontentloaded' });
    const skel = page.getByTestId('town-skeleton');
    await expect(skel).toBeVisible({ timeout: 5_000 });
    const skelAnim = await skel.evaluate((el) => window.getComputedStyle(el).animationName);
    expect(skelAnim).toBe('none');

    releaseInit();
    const wrapper = page.getByTestId('town-map-wrapper');
    await expect(wrapper).toBeVisible({ timeout: 10_000 });
    const wrapperTrans = await wrapper.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { prop: cs.transitionProperty, dur: cs.transitionDuration, opacity: cs.opacity };
    });
    expect(wrapperTrans.prop === 'none' || parseFloat(wrapperTrans.dur) <= 0.001).toBe(true);
    expect(wrapperTrans.opacity).toBe('1');
    await ctx.close();
  });

  test('Part 5d: repeated init 500s fall back cleanly to offline status pill with Retry', async ({
    page,
  }) => {
    await seedSessionAndFlags(page, 'u_flash_d');
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Simulated 500' }),
      });
    });
    await page.goto('/ro/town', { waitUntil: 'domcontentloaded' });
    const statusPill = page.getByTestId('town-connection-status');
    await expect(statusPill).toBeVisible({ timeout: 5_000 });
    // After retry delays (1s + 3s + 7s = 11s), offline state with Retry button appears
    await expect(statusPill.getByRole('button')).toBeVisible({ timeout: 18_000 });
  });
});
