import { expect, test } from '@playwright/test';

const FIREBASE_API_KEY = 'AIzaSyC1xcAcVnO71-zdXjQE_7RYurgGw-bnE0o';

test.use({
  viewport: { width: 390, height: 844 },
  serviceWorkers: 'block',
  launchOptions: { args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-gpu'] },
});

test.describe('PaymentAuthGate on /en/pro', () => {
  test('guest mode opens PaymentAuthGate on Activate and does not call checkout', async ({
    page,
  }) => {
    let checkoutCalls = 0;

    await page.addInitScript(() => {
      window.sessionStorage.setItem('ronduel_splash_seen_v2', '1');
      window.localStorage.setItem('rd_last_active_at', String(Date.now()));
      window.localStorage.setItem(
        'ronduel_session_v1',
        JSON.stringify({
          uid: 'u_e2e_guest_gate',
          nickname: 'GuestPlayer',
          ageConfirmed16: true,
          relaxedTimer: false,
          theme: 'light',
          analyticsConsent: 'rejected',
          isAnonymous: true,
          authProvider: 'anonymous',
        }),
      );
    });

    await page.route('**/api/me/profile**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          uid: 'u_e2e_guest_gate',
          nickname: 'GuestPlayer',
          isAnonymous: true,
          pro: { active: false },
        }),
      });
    });

    await page.route('**/api/billing/checkout**', async (route) => {
      checkoutCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mode: 'stripe_checkout', checkoutUrl: '/en/pro?checkout=success' }),
      });
    });

    await page.goto('/en/pro', { waitUntil: 'domcontentloaded' });
    const consentBox = page.locator('input[type="checkbox"]');
    await expect(consentBox).toBeVisible({ timeout: 15_000 });
    await expect(consentBox).not.toBeChecked();

    await consentBox.check();
    await page
      .getByRole('button', { name: /activate|subscribe|pro/i })
      .last()
      .click();

    await expect(page.getByTestId('payment-auth-gate')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('payment-gate-google-btn')).toBeVisible();
    await expect(page.getByTestId('payment-gate-email-btn')).toBeVisible();
    expect(checkoutCalls).toBe(0);
  });

  test('signed-in user bypasses gate and requests /api/billing/checkout directly', async ({
    page,
  }) => {
    let checkoutCalls = 0;
    let receivedAuth = '';

    await page.addInitScript((apiKey) => {
      window.sessionStorage.setItem('ronduel_splash_seen_v2', '1');
      window.localStorage.setItem('rd_last_active_at', String(Date.now()));
      window.localStorage.setItem(
        'ronduel_session_v1',
        JSON.stringify({
          uid: 'u_e2e_real_user',
          nickname: 'RealPlayer',
          ageConfirmed16: true,
          relaxedTimer: false,
          theme: 'light',
          analyticsConsent: 'rejected',
          email: 'real@example.com',
          isAnonymous: false,
          authProvider: 'google.com',
        }),
      );
      window.localStorage.setItem(
        `firebase:authUser:${apiKey}:[DEFAULT]`,
        JSON.stringify({
          uid: 'u_e2e_real_user',
          email: 'real@example.com',
          emailVerified: true,
          displayName: 'RealPlayer',
          isAnonymous: false,
          providerData: [
            {
              providerId: 'google.com',
              uid: 'google_123',
              displayName: 'RealPlayer',
              email: 'real@example.com',
              phoneNumber: null,
              photoURL: null,
            },
          ],
          stsTokenManager: {
            refreshToken: 'fake_refresh_token',
            accessToken: 'fake_valid_id_token_e2e',
            expirationTime: Date.now() + 3600_000,
          },
          createdAt: String(Date.now() - 86_400_000),
          lastLoginAt: String(Date.now()),
          apiKey,
          appName: '[DEFAULT]',
        }),
      );
    }, FIREBASE_API_KEY);

    await page.route('**/identitytoolkit.googleapis.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [
            {
              localId: 'u_e2e_real_user',
              email: 'real@example.com',
              emailVerified: true,
              displayName: 'RealPlayer',
            },
          ],
        }),
      });
    });

    await page.route('**/api/me/profile**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          uid: 'u_e2e_real_user',
          nickname: 'RealPlayer',
          email: 'real@example.com',
          isAnonymous: false,
          pro: { active: false },
        }),
      });
    });

    await page.route('**/api/billing/checkout**', async (route) => {
      checkoutCalls += 1;
      receivedAuth = route.request().headers()['authorization'] ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'stripe_checkout',
          sessionId: 'cs_test_e2e_signed',
          pro: { active: true, plan: 'yearly' },
        }),
      });
    });

    await page.goto('/en/pro', { waitUntil: 'domcontentloaded' });
    const consentBox = page.locator('input[type="checkbox"]');
    await expect(consentBox).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('pro-upgrade-first-box')).toHaveCount(0);
    await consentBox.check();

    await page
      .getByRole('button', { name: /activate|subscribe|pro/i })
      .last()
      .click();

    await expect.poll(() => checkoutCalls, { timeout: 5_000 }).toBe(1);
    expect(receivedAuth).toBe('Bearer fake_valid_id_token_e2e');
    await expect(page.getByTestId('payment-auth-gate')).toHaveCount(0);
  });
});

function buildTownInitPayload() {
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
      plotsOwned: 1,
      land: {
        '3_3': 'basic-block',
        '3_4': 'basic-block',
        '4_3': 'basic-block',
        '4_4': 'basic-block',
      },
    },
    tiles: {
      '3_3': { x: 3, y: 3, itemId: 'starter_house' },
    },
    walletBalance: 100,
    inventory: {},
    orders: [],
    ordersUnlocked: true,
  };
}

test.describe('PaymentAuthGate on RonTown coin packs', () => {
  test('signed-in user buys RonCoins pack directly without opening PaymentAuthGate', async ({
    page,
  }) => {
    let checkoutCalls = 0;
    let lastPackId = '';

    await page.addInitScript((apiKey) => {
      window.sessionStorage.setItem('ronduel_splash_seen_v2', '1');
      window.localStorage.setItem('rd_last_active_at', String(Date.now()));
      window.localStorage.setItem('ff_town_enabled', '1');
      window.localStorage.setItem('ff_coins_purchase_enabled', '1');
      window.localStorage.setItem(
        'ronduel_session_v1',
        JSON.stringify({
          uid: 'u_e2e_town_real',
          nickname: 'AndreiReal',
          ageConfirmed16: true,
          relaxedTimer: false,
          theme: 'light',
          analyticsConsent: 'rejected',
          email: 'andrei@example.com',
          isAnonymous: false,
          authProvider: 'google',
        }),
      );
      window.localStorage.setItem(
        `firebase:authUser:${apiKey}:[DEFAULT]`,
        JSON.stringify({
          uid: 'u_e2e_town_real',
          email: 'andrei@example.com',
          emailVerified: true,
          displayName: 'AndreiReal',
          isAnonymous: false,
          providerData: [
            {
              providerId: 'google.com',
              uid: 'google_town_123',
              displayName: 'AndreiReal',
              email: 'andrei@example.com',
              phoneNumber: null,
              photoURL: null,
            },
          ],
          stsTokenManager: {
            refreshToken: 'fake_refresh_token',
            accessToken: 'fake_valid_id_token_town',
            expirationTime: Date.now() + 3600_000,
          },
          createdAt: String(Date.now() - 86_400_000),
          lastLoginAt: String(Date.now()),
          apiKey,
          appName: '[DEFAULT]',
        }),
      );
    }, FIREBASE_API_KEY);

    await page.route('**/identitytoolkit.googleapis.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [
            {
              localId: 'u_e2e_town_real',
              email: 'andrei@example.com',
              emailVerified: true,
              displayName: 'AndreiReal',
            },
          ],
        }),
      });
    });
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildTownInitPayload()),
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
    await page.route('**/api/town/checkout*', async (route) => {
      checkoutCalls += 1;
      const body = route.request().postDataJSON() as { packId?: string };
      lastPackId = body?.packId ?? '';
      // Return 200 without checkoutUrl so page stays put and we can assert gate count === 0
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, packId: lastPackId }),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });

    // Open RonCoin store via header wallet pill
    await page.getByTestId('town-wallet-balance').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Click first coin pack button
    await dialog.getByRole('button', { name: /€1\.99/i }).click();

    await expect.poll(() => checkoutCalls, { timeout: 5_000 }).toBe(1);
    expect(lastPackId).toBe('pack_1000');
    await expect(page.getByTestId('payment-auth-gate')).toHaveCount(0);
    await expect(page.getByTestId('payment-gate-auth-loading')).toHaveCount(0);
  });

  test('guest on RonTown sees PaymentAuthGate on coin pack tap and never calls checkout', async ({
    page,
  }) => {
    let checkoutCalls = 0;

    await page.addInitScript(() => {
      window.sessionStorage.setItem('ronduel_splash_seen_v2', '1');
      window.localStorage.setItem('rd_last_active_at', String(Date.now()));
      window.localStorage.setItem('ff_town_enabled', '1');
      window.localStorage.setItem('ff_coins_purchase_enabled', '1');
      window.localStorage.setItem(
        'ronduel_session_v1',
        JSON.stringify({
          uid: 'u_e2e_town_guest',
          nickname: 'GuestTown',
          ageConfirmed16: true,
          relaxedTimer: false,
          theme: 'light',
          analyticsConsent: 'rejected',
          isAnonymous: true,
          authProvider: 'anonymous',
        }),
      );
    });

    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildTownInitPayload()),
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
    await page.route('**/api/town/checkout*', async (route) => {
      checkoutCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('town-wallet-balance').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole('button', { name: /€1\.99/i }).click();

    await expect(page.getByTestId('payment-auth-gate')).toBeVisible({ timeout: 5_000 });
    expect(checkoutCalls).toBe(0);
  });

  test('slow Auth hydration shows payment-gate-auth-loading (not gate), then runs checkout once real user restores', async ({
    page,
  }) => {
    let checkoutCalls = 0;

    await page.addInitScript((apiKey) => {
      window.sessionStorage.setItem('ronduel_splash_seen_v2', '1');
      window.localStorage.setItem('rd_last_active_at', String(Date.now()));
      window.localStorage.setItem('ff_town_enabled', '1');
      window.localStorage.setItem('ff_coins_purchase_enabled', '1');
      window.localStorage.setItem(
        'ronduel_session_v1',
        JSON.stringify({
          uid: 'u_e2e_town_slow_auth',
          nickname: 'SlowAuthUser',
          ageConfirmed16: true,
          relaxedTimer: false,
          theme: 'light',
          analyticsConsent: 'rejected',
          email: 'slow@example.com',
          isAnonymous: false,
          authProvider: 'google.com',
        }),
      );
      window.localStorage.setItem(
        `firebase:authUser:${apiKey}:[DEFAULT]`,
        JSON.stringify({
          uid: 'u_e2e_town_slow_auth',
          email: 'slow@example.com',
          emailVerified: true,
          displayName: 'SlowAuthUser',
          isAnonymous: false,
          providerData: [
            {
              providerId: 'google.com',
              uid: 'google_slow_123',
              displayName: 'SlowAuthUser',
              email: 'slow@example.com',
              phoneNumber: null,
              photoURL: null,
            },
          ],
          stsTokenManager: {
            refreshToken: 'fake_refresh_token',
            accessToken: 'fake_valid_id_token_slow',
            expirationTime: Date.now() + 3600_000,
          },
          createdAt: String(Date.now() - 86_400_000),
          lastLoginAt: String(Date.now()),
          apiKey,
          appName: '[DEFAULT]',
        }),
      );

      // Pause Firebase Auth's IndexedDB open until the test releases it, simulating slow PWA/Safari hydration
      const rawOpen = window.indexedDB.open.bind(window.indexedDB);
      const pendingOpens: Array<() => void> = [];
      let released = false;
      (window as unknown as { __releaseFirebaseIdb?: () => void }).__releaseFirebaseIdb = () => {
        released = true;
        while (pendingOpens.length > 0) {
          const fn = pendingOpens.shift();
          fn?.();
        }
      };

      window.indexedDB.open = function (name: string, version?: number) {
        if (name !== 'firebaseLocalStorageDb' || released) {
          return version !== undefined ? rawOpen(name, version) : rawOpen(name);
        }
        const fakeReq: Record<string, unknown> = {
          readyState: 'pending',
          result: undefined,
          error: null,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          onblocked: null,
          _listeners: new Map<string, Set<EventListenerOrEventListenerObject>>(),
          addEventListener(type: string, cb: EventListenerOrEventListenerObject) {
            const map = this._listeners as Map<string, Set<EventListenerOrEventListenerObject>>;
            if (!map.has(type)) map.set(type, new Set());
            map.get(type)!.add(cb);
          },
          removeEventListener(type: string, cb: EventListenerOrEventListenerObject) {
            const map = this._listeners as Map<string, Set<EventListenerOrEventListenerObject>>;
            map.get(type)?.delete(cb);
          },
        };
        const fire = (type: string, evt: Event) => {
          const handler = fakeReq[`on${type}`];
          if (typeof handler === 'function') (handler as (e: Event) => void).call(fakeReq, evt);
          const set = (
            fakeReq._listeners as Map<string, Set<EventListenerOrEventListenerObject>>
          ).get(type);
          if (set) {
            for (const cb of set) {
              if (typeof cb === 'function') cb(evt);
              else cb.handleEvent(evt);
            }
          }
        };
        pendingOpens.push(() => {
          const realReq = version !== undefined ? rawOpen(name, version) : rawOpen(name);
          realReq.onupgradeneeded = (e) => {
            fakeReq.result = realReq.result;
            fire('upgradeneeded', e);
          };
          realReq.onsuccess = (e) => {
            fakeReq.readyState = 'done';
            fakeReq.result = realReq.result;
            fire('success', e);
          };
          realReq.onerror = (e) => {
            fakeReq.readyState = 'done';
            fakeReq.error = realReq.error;
            fire('error', e);
          };
        });
        return fakeReq as unknown as IDBOpenDBRequest;
      };
    }, FIREBASE_API_KEY);

    await page.route('**/identitytoolkit.googleapis.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [
            {
              localId: 'u_e2e_town_slow_auth',
              email: 'slow@example.com',
              emailVerified: true,
              displayName: 'SlowAuthUser',
            },
          ],
        }),
      });
    });
    await page.route('**/api/town/init*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildTownInitPayload()),
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
    await page.route('**/api/town/checkout*', async (route) => {
      checkoutCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/en/town', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('town-wallet-balance').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole('button', { name: /€1\.99/i }).click();

    // Auth is still hydrating: loading indicator appears, gate does NOT appear, checkout does NOT fire
    const loader = page.getByTestId('payment-gate-auth-loading');
    await expect(loader).toBeVisible({ timeout: 5_000 });
    await expect(loader).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('payment-auth-gate')).toHaveCount(0);
    expect(checkoutCalls).toBe(0);

    // Release Firebase Auth IndexedDB -> real user restores -> checkout fires directly without gate!
    await page.evaluate(() => {
      (window as unknown as { __releaseFirebaseIdb?: () => void }).__releaseFirebaseIdb?.();
    });

    await expect.poll(() => checkoutCalls, { timeout: 10_000 }).toBe(1);
    await expect(page.getByTestId('payment-auth-gate')).toHaveCount(0);
    await expect(page.getByTestId('payment-gate-auth-loading')).toHaveCount(0);
  });
});
