import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const SHOTS_DIR = process.env.RONTOWN_SHOTS_DIR || '';

function shotPath(name: string): string | null {
  return SHOTS_DIR ? path.join(SHOTS_DIR, name) : null;
}

function buildLand(): Record<string, string> {
  const land: Record<string, string> = {};
  for (let x = 2; x <= 4; x++) {
    for (let y = 2; y <= 4; y++) {
      land[`${x}_${y}`] = 'basic-block';
    }
  }
  return land;
}

async function seedLocaleTown(page: Page, uid: string): Promise<void> {
  await page.addInitScript((sessionUid: string) => {
    window.localStorage.setItem(
      'ronduel_session_v1',
      JSON.stringify({
        uid: sessionUid,
        nickname: 'I18nTester',
        ageConfirmed16: true,
        relaxedTimer: false,
        theme: 'light',
        analyticsConsent: 'rejected',
      }),
    );
    window.localStorage.setItem('ff_town_enabled', '1');
  }, uid);
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
          plotsOwned: 1,
          land: buildLand(),
        },
        tiles: {
          '3_3': { x: 3, y: 3, itemId: 'starter_house' },
          '3_4': { x: 3, y: 4, itemId: 'plot' },
        },
        walletBalance: 250,
        inventory: {},
        orders: [],
        ordersUnlocked: true,
      }),
    });
  });
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

const LOCALE_CASES = [
  {
    locale: 'de',
    expectedRotateAria: 'Drehen',
    expectedLandTitle: 'Land kaufen',
    shot: 'rontown_i18n_de_390.png',
  },
  {
    locale: 'pl',
    expectedRotateAria: 'Obróć',
    expectedLandTitle: 'Kup ziemię',
    shot: 'rontown_i18n_pl_390.png',
  },
  {
    locale: 'uk',
    expectedRotateAria: 'Повернути',
    expectedLandTitle: 'Купити землю',
    shot: 'rontown_i18n_uk_390.png',
  },
] as const;

test.describe('RonTown Full i18n (de, pl, uk at 390px)', () => {
  for (const cfg of LOCALE_CASES) {
    test(`renders localized toolbar aria-labels and Buy Land sheet on /${cfg.locale}/town`, async ({
      page,
    }) => {
      await seedLocaleTown(page, `u_e2e_i18n_${cfg.locale}`);
      await page.goto(`/${cfg.locale}/town`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });

      const rotateBtn = page.getByTestId('toolbar-rotate-btn');
      await expect(rotateBtn).toBeVisible();
      await expect(rotateBtn).toHaveAttribute('aria-label', cfg.expectedRotateAria);

      // Open Buy Land sheet by tapping an expand ring cell
      const expandBtn = page
        .locator('button[aria-label*="(1, 2)"]')
        .or(page.locator('button[aria-label*="(2, 1)"]'));
      await expandBtn.first().click({ force: true });

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(cfg.expectedLandTitle);
      await expect(dialog).not.toContainText('Buy land');

      const shot = shotPath(cfg.shot);
      if (shot) {
        await page.screenshot({ path: shot });
      }
    });
  }
});
