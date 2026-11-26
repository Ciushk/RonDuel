import { expect, test } from '@playwright/test';

async function seedSessionAndSwMock(
  page: import('@playwright/test').Page,
  options?: { simulateWaitingSw?: boolean },
) {
  const simulateWaitingSw = options?.simulateWaitingSw ?? true;
  await page.addInitScript(
    ({ waitingEnabled }) => {
      window.sessionStorage.setItem('ronduel_splash_seen_v2', '1');
      if (!window.sessionStorage.getItem('rd-sw-seen-build')) {
        window.sessionStorage.setItem('rd-sw-seen-build', 'e2e-build-v1');
      }
      window.localStorage.setItem(
        'ronduel_session_v1',
        JSON.stringify({
          uid: 'u_e2e_pwa_toast',
          nickname: 'PwaTester',
          ageConfirmed16: true,
          relaxedTimer: false,
          theme: 'light',
          analyticsConsent: 'rejected',
        }),
      );

      if (!waitingEnabled) return;

      const listeners = new Map<string, Set<EventListener>>();
      const add = (type: string, fn: EventListener) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      };
      const remove = (type: string, fn: EventListener) => {
        listeners.get(type)?.delete(fn);
      };
      const emit = (type: string) => {
        const evt = new Event(type);
        listeners.get(type)?.forEach((fn) => fn(evt));
      };

      const alreadyUpdated = window.sessionStorage.getItem('e2e_sw_updated') === '1';

      const waitingWorker = alreadyUpdated
        ? null
        : {
            state: 'installed',
            postMessage(msg: unknown) {
              if (msg === 'SKIP_WAITING' || (msg && (msg as { type?: string }).type === 'SKIP_WAITING')) {
                const count = Number(window.sessionStorage.getItem('e2e_skip_waiting_count') || '0') + 1;
                window.sessionStorage.setItem('e2e_skip_waiting_count', String(count));
                window.sessionStorage.setItem('e2e_sw_updated', '1');
                window.setTimeout(() => emit('controllerchange'), 20);
              }
            },
            addEventListener() {},
            removeEventListener() {},
          };

      const fakeRegistration = {
        scope: '/',
        waiting: waitingWorker,
        installing: null,
        active: { state: 'activated' },
        update: async () => fakeRegistration,
        unregister: async () => true,
        addEventListener() {},
        removeEventListener() {},
      };

      const fakeSw = {
        controller: { state: 'activated' },
        register: async (scriptUrl: string) => {
          window.sessionStorage.setItem('e2e_sw_script_url', scriptUrl);
          return fakeRegistration;
        },
        getRegistrations: async () => [fakeRegistration],
        addEventListener: add,
        removeEventListener: remove,
      };

      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: fakeSw,
      });
    },
    { waitingEnabled: simulateWaitingSw },
  );
}

test.use({
  serviceWorkers: 'block',
  launchOptions: { args: ['--disable-dev-shm-usage'] },
});

test.describe('PWA update toast & Settings cache reset', () => {

  test('shows Split Court update toast on new build and reloads once on Reload click', async ({
    page,
  }) => {
    await seedSessionAndSwMock(page, { simulateWaitingSw: true });

    let versionRequests = 0;
    await page.route('**/version.json', async (route) => {
      versionRequests += 1;
      // First load sees newer buildId; after reload it still resolves cleanly without looping
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-cache, no-store, must-revalidate' },
        body: JSON.stringify({
          buildId: 'e2e-build-v2',
          builtAt: '2026-11-26T00:00:00.000Z',
        }),
      });
    });

    await page.goto('/en/leagues', { waitUntil: 'load' });

    const toast = page.getByTestId('pwa-update-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText('New version available');

    const registeredUrl = await page.evaluate(() =>
      window.sessionStorage.getItem('e2e_sw_script_url'),
    );
    expect(registeredUrl).toBe('/sw.js?v=2');

    // Count real document reload requests triggered by clicking Reload
    let reloadCount = 0;
    page.on('request', (req) => {
      if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
        reloadCount += 1;
      }
    });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      toast.getByRole('button', { name: 'Reload' }).click(),
    ]);
    await page.waitForTimeout(800);

    expect(reloadCount).toBe(1);
    expect(versionRequests).toBeGreaterThanOrEqual(2);

    const skipWaitingCount = await page.evaluate(() =>
      Number(window.sessionStorage.getItem('e2e_skip_waiting_count') || '0'),
    );
    expect(skipWaitingCount).toBe(1);

    // After reloading to the updated version, the toast must not loop back in
    await expect(page.getByTestId('pwa-update-toast')).toHaveCount(0);
  });

  test('does not show update toast on /en/play and shows it after leaving /en/play', async ({
    page,
  }) => {
    await seedSessionAndSwMock(page, { simulateWaitingSw: true });

    await page.route('**/version.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          buildId: 'e2e-build-v2',
          builtAt: '2026-11-26T00:00:00.000Z',
        }),
      });
    });

    await page.goto('/en/play', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('pwa-update-toast')).toHaveCount(0);

    // Navigate away from /en/play -> toast now appears
    await page.goto('/en/leagues', { waitUntil: 'load' });
    await expect(page.getByTestId('pwa-update-toast')).toBeVisible({ timeout: 5000 });
  });

  test('Settings shows Clear cache & reload button and hint above Delete my account', async ({
    page,
  }) => {
    await seedSessionAndSwMock(page, { simulateWaitingSw: false });
    await page.route('**/version.json', (route) => route.fulfill({ status: 404, body: '' }));

    await page.goto('/en/settings', { waitUntil: 'load' });

    const clearBtn = page.getByRole('button', { name: 'Clear cache & reload' });
    const deleteBtn = page.getByRole('button', { name: 'Delete my account' });

    await expect(clearBtn).toBeVisible();
    await expect(
      page.getByText('Fixes stale images after an update. Does not sign you out.'),
    ).toBeVisible();
    await expect(deleteBtn).toBeVisible();

    const clearBox = await clearBtn.boundingBox();
    const deleteBox = await deleteBtn.boundingBox();
    expect(clearBox).not.toBeNull();
    expect(deleteBox).not.toBeNull();
    expect(clearBox!.y).toBeLessThan(deleteBox!.y);
  });
});
