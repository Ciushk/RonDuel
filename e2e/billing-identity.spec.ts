import { expect, test, type Page } from '@playwright/test';

const FIREBASE_API_KEY = 'AIzaSyC1xcAcVnO71-zdXjQE_7RYurgGw-bnE0o';

test.setTimeout(60_000);

test.use({
  serviceWorkers: 'block',
  launchOptions: { args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-gpu'] },
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

function makeFakeJwt(uid: string, email: string): string {
  const b64 = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const header = b64({ alg: 'RS256', typ: 'JWT' });
  const payload = b64({
    iss: 'https://securetoken.google.com/ronduel',
    aud: 'ronduel',
    auth_time: nowSec,
    user_id: uid,
    sub: uid,
    iat: nowSec,
    exp: nowSec + 3600,
    email,
    email_verified: true,
    firebase: { sign_in_provider: 'custom' },
  });
  return `${header}.${payload}.fake_sig`;
}

async function seedMismatchedSessionAndAuth(
  page: Page,
  opts: {
    ronduelUid: string;
    firebaseUid: string;
    email: string;
    initialToken: string;
    townFlags?: boolean;
  },
) {
  await page.addInitScript(
    ({ apiKey, ronduelUid, firebaseUid, email, initialToken, townFlags }) => {
      window.sessionStorage.setItem('ronduel_splash_seen_v2', '1');
      window.localStorage.setItem('rd_last_active_at', String(Date.now()));
      if (townFlags) {
        window.localStorage.setItem('ff_town_enabled', '1');
        window.localStorage.setItem('ff_coins_purchase_enabled', '1');
      }
      window.localStorage.setItem(
        'ronduel_session_v1',
        JSON.stringify({
          uid: ronduelUid,
          nickname: 'Andrei',
          ageConfirmed16: true,
          relaxedTimer: false,
          theme: 'light',
          analyticsConsent: 'rejected',
          email,
          isAnonymous: false,
          authProvider: 'google.com',
        }),
      );
      window.localStorage.setItem(
        `firebase:authUser:${apiKey}:[DEFAULT]`,
        JSON.stringify({
          uid: firebaseUid,
          email,
          emailVerified: true,
          displayName: 'Andrei',
          isAnonymous: false,
          providerData: [
            {
              providerId: 'google.com',
              uid: 'google_sub_123',
              displayName: 'Andrei',
              email,
              phoneNumber: null,
              photoURL: null,
            },
          ],
          stsTokenManager: {
            refreshToken: 'fake_initial_refresh',
            accessToken: initialToken,
            expirationTime: Date.now() + 3600_000,
          },
          createdAt: String(Date.now() - 86_400_000),
          lastLoginAt: String(Date.now()),
          apiKey,
          appName: '[DEFAULT]',
        }),
      );
    },
    { apiKey: FIREBASE_API_KEY, ...opts },
  );
}

async function mockIdentityToolkitForCustomExchange(
  page: Page,
  opts: {
    ronduelUid: string;
    firebaseUid: string;
    email: string;
    alignedJwt: string;
    emailPasswordLoginUid?: string;
    emailPasswordLoginJwt?: string;
  },
) {
  await page.route('**/identitytoolkit.googleapis.com/**', async (route) => {
    const url = route.request().url();
    const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;

    if (url.includes('accounts:signInWithCustomToken')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'identitytoolkit#VerifyCustomTokenResponse',
          idToken: opts.alignedJwt,
          refreshToken: 'custom_refresh_token',
          expiresIn: '3600',
          isNewUser: false,
        }),
      });
      return;
    }

    if (url.includes('accounts:signInWithPassword')) {
      const loginUid = opts.emailPasswordLoginUid ?? opts.firebaseUid;
      const loginJwt = opts.emailPasswordLoginJwt ?? makeFakeJwt(loginUid, opts.email);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'identitytoolkit#VerifyPasswordResponse',
          localId: loginUid,
          email: String(body.email ?? opts.email),
          displayName: 'Andrei',
          idToken: loginJwt,
          registered: true,
          refreshToken: 'pw_refresh_token',
          expiresIn: '3600',
        }),
      });
      return;
    }

    if (url.includes('accounts:lookup')) {
      const idToken = String(body.idToken ?? '');
      const isAligned = idToken === opts.alignedJwt;
      const isPwLogin = Boolean(
        opts.emailPasswordLoginJwt && idToken === opts.emailPasswordLoginJwt,
      );
      const localId = isAligned
        ? opts.ronduelUid
        : isPwLogin && opts.emailPasswordLoginUid
          ? opts.emailPasswordLoginUid
          : opts.firebaseUid;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [
            {
              localId,
              email: opts.email,
              emailVerified: true,
              displayName: 'Andrei',
            },
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  await page.route('**/securetoken.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: opts.alignedJwt,
        id_token: opts.alignedJwt,
        refresh_token: 'custom_refresh_token',
        expires_in: '3600',
        user_id: opts.ronduelUid,
      }),
    });
  });
}

for (const viewport of [
  { name: '390x844', width: 390, height: 844 },
  { name: '1280x800', width: 1280, height: 800 },
]) {
  test.describe(`Billing identity custom-token alignment (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('Pro monthly on /ro/pro exchanges mismatched Firebase uid and sends aligned Bearer token without opening gate', async ({
      page,
    }) => {
      const ronduelUid = 'u_andrei89';
      const firebaseUid = 'fb_google_mismatch_1';
      const email = 'eu.andrei89@gmail.com';
      const initialJwt = makeFakeJwt(firebaseUid, email);
      const alignedJwt = makeFakeJwt(ronduelUid, email);

      let exchangeAuth = '';
      let checkoutAuth = '';
      let checkoutBody: Record<string, unknown> | null = null;

      await seedMismatchedSessionAndAuth(page, {
        ronduelUid,
        firebaseUid,
        email,
        initialToken: initialJwt,
      });
      await mockIdentityToolkitForCustomExchange(page, {
        ronduelUid,
        firebaseUid,
        email,
        alignedJwt,
      });

      await page.route('**/api/me/profile**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            uid: ronduelUid,
            nickname: 'Andrei',
            email,
            isAnonymous: false,
            authProvider: 'google.com',
            pro: { active: false },
          }),
        });
      });

      await page.route('**/api/auth/exchange**', async (route) => {
        exchangeAuth = route.request().headers()['authorization'] ?? '';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ customToken: 'fake_custom_token_u_andrei89', uid: ronduelUid }),
        });
      });

      await page.route('**/api/billing/checkout**', async (route) => {
        checkoutAuth = route.request().headers()['authorization'] ?? '';
        checkoutBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            mode: 'stripe_checkout',
            sessionId: 'cs_pro_monthly_e2e',
            pro: { active: true, plan: 'monthly' },
          }),
        });
      });

      await page.goto('/ro/pro', { waitUntil: 'domcontentloaded' });
      const consentBox = page.locator('input[type="checkbox"]');
      await expect(consentBox).toBeVisible({ timeout: 15_000 });

      // Select monthly plan (4,99 €)
      await page.getByRole('button', { name: /4,99|4\.99/i }).click();
      await consentBox.check();
      await page
        .getByRole('button', { name: /activează|abonează|pro/i })
        .last()
        .click();

      await expect.poll(() => checkoutAuth, { timeout: 10_000 }).toBe(`Bearer ${alignedJwt}`);
      expect(exchangeAuth).toBe(`Bearer ${initialJwt}`);
      expect(checkoutBody?.plan).toBe('monthly');
      await expect(page.getByTestId('payment-auth-gate')).toHaveCount(0);
    });

    test('Shield pack freeze_1 on /ro/me exchanges custom token and posts /api/billing/freeze with Bearer and no uid in body', async ({
      page,
    }) => {
      const ronduelUid = 'u_andrei89';
      const firebaseUid = 'fb_google_mismatch_2';
      const email = 'eu.andrei89@gmail.com';
      const initialJwt = makeFakeJwt(firebaseUid, email);
      const alignedJwt = makeFakeJwt(ronduelUid, email);

      let exchangeCalls = 0;
      let freezeAuth = '';
      let freezeBody: Record<string, unknown> | null = null;

      await seedMismatchedSessionAndAuth(page, {
        ronduelUid,
        firebaseUid,
        email,
        initialToken: initialJwt,
      });
      await mockIdentityToolkitForCustomExchange(page, {
        ronduelUid,
        firebaseUid,
        email,
        alignedJwt,
      });

      await page.route('**/api/me/profile**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            uid: ronduelUid,
            nickname: 'Andrei',
            email,
            isAnonymous: false,
            authProvider: 'google.com',
            isAdmin: false,
            pro: { active: false },
            notif: { pushEnabled: false, emailEnabled: false, reminderLocalTime: '20:00' },
            streakCurrent: 4,
            streakBest: 7,
            freezes: 0,
            playedDates: [],
            topicAccuracy: [],
          }),
        });
      });

      await page.route('**/api/auth/exchange**', async (route) => {
        exchangeCalls += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ customToken: 'fake_custom_token_u_andrei89', uid: ronduelUid }),
        });
      });

      await page.route('**/api/billing/freeze**', async (route) => {
        freezeAuth = route.request().headers()['authorization'] ?? '';
        freezeBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ mode: 'emulator_simulated', freezes: 1 }),
        });
      });

      await page.goto('/ro/me', { waitUntil: 'domcontentloaded' });
      const shieldPill = page.getByRole('button', { name: /🧊/ });
      await expect(shieldPill).toBeVisible({ timeout: 15_000 });
      await shieldPill.click();

      const buyOneBtn = page.getByRole('button', { name: /0,99\s*€/i });
      await expect(buyOneBtn).toBeVisible({ timeout: 5_000 });
      await buyOneBtn.click();

      await expect.poll(() => freezeAuth, { timeout: 10_000 }).toBe(`Bearer ${alignedJwt}`);
      expect(exchangeCalls).toBe(1);
      expect(freezeBody).toEqual({ pack: 'freeze_1', locale: 'ro' });
      expect(freezeBody && 'uid' in freezeBody).toBe(false);
      await expect(page.getByTestId('payment-auth-gate')).toHaveCount(0);
    });

    test('RonTown €4.99 pack on /ro/town exchanges custom token and posts /api/town/checkout with aligned Bearer token', async ({
      page,
    }) => {
      const ronduelUid = 'u_andrei89';
      const firebaseUid = 'fb_google_mismatch_3';
      const email = 'eu.andrei89@gmail.com';
      const initialJwt = makeFakeJwt(firebaseUid, email);
      const alignedJwt = makeFakeJwt(ronduelUid, email);

      let checkoutAuth = '';
      let checkoutBody: Record<string, unknown> | null = null;

      await seedMismatchedSessionAndAuth(page, {
        ronduelUid,
        firebaseUid,
        email,
        initialToken: initialJwt,
        townFlags: true,
      });
      await mockIdentityToolkitForCustomExchange(page, {
        ronduelUid,
        firebaseUid,
        email,
        alignedJwt,
      });

      await page.route('**/api/me/profile**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            uid: ronduelUid,
            email,
            isAnonymous: false,
            authProvider: 'google.com',
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
      await page.route('**/api/auth/exchange**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ customToken: 'fake_custom_token_u_andrei89', uid: ronduelUid }),
        });
      });
      await page.route('**/api/town/checkout*', async (route) => {
        checkoutAuth = route.request().headers()['authorization'] ?? '';
        checkoutBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, packId: checkoutBody?.packId }),
        });
      });

      await page.goto('/ro/town', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-rontown-stage="true"]')).toBeVisible({ timeout: 15_000 });

      await page.getByTestId('town-wallet-balance').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      await dialog.getByRole('button', { name: /€4\.99|4,99/i }).click();

      await expect.poll(() => checkoutAuth, { timeout: 10_000 }).toBe(`Bearer ${alignedJwt}`);
      expect(checkoutBody?.packId).toBe('pack_2800');
      await expect(page.getByTestId('payment-auth-gate')).toHaveCount(0);
    });

    test('real RonDuel account without Firebase Auth opens reauth gate, rejects foreign uid without overwriting session, and succeeds after matching login', async ({
      page,
    }) => {
      const ronduelUid = 'u_andrei89';
      const email = 'eu.andrei89@gmail.com';
      const foreignFirebaseUid = 'fb_foreign_user';
      const foreignLoginJwt = makeFakeJwt(foreignFirebaseUid, 'other@example.com');
      const alignedJwt = makeFakeJwt(ronduelUid, email);

      let exchangeCalls = 0;
      let checkoutCalls = 0;
      let checkoutAuth = '';

      await page.addInitScript(
        ({ uid, userEmail }) => {
          window.sessionStorage.setItem('ronduel_splash_seen_v2', '1');
          window.localStorage.setItem('rd_last_active_at', String(Date.now()));
          window.localStorage.setItem(
            'ronduel_session_v1',
            JSON.stringify({
              uid,
              nickname: 'Andrei',
              ageConfirmed16: true,
              relaxedTimer: false,
              theme: 'light',
              analyticsConsent: 'rejected',
              email: userEmail,
              isAnonymous: false,
              authProvider: 'google.com',
            }),
          );
        },
        { uid: ronduelUid, userEmail: email },
      );

      await mockIdentityToolkitForCustomExchange(page, {
        ronduelUid,
        firebaseUid: 'fb_matching_user',
        email,
        alignedJwt,
        emailPasswordLoginUid: foreignFirebaseUid,
        emailPasswordLoginJwt: foreignLoginJwt,
      });

      await page.route('**/api/me/profile**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            uid: ronduelUid,
            nickname: 'Andrei',
            email,
            isAnonymous: false,
            authProvider: 'google.com',
            pro: { active: false },
          }),
        });
      });

      await page.route('**/api/auth/exchange**', async (route) => {
        exchangeCalls += 1;
        if (exchangeCalls === 1) {
          // First attempt: user logged into a DIFFERENT account -> foreign uid returned
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ customToken: 'custom_foreign', uid: 'u_foreign_account' }),
          });
          return;
        }
        // Second attempt: user logged into the matching account -> aligned uid returned
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ customToken: 'custom_aligned', uid: ronduelUid }),
        });
      });

      await page.route('**/api/billing/checkout**', async (route) => {
        checkoutCalls += 1;
        checkoutAuth = route.request().headers()['authorization'] ?? '';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            mode: 'stripe_checkout',
            sessionId: 'cs_reauth_ok',
            pro: { active: true, plan: 'yearly' },
          }),
        });
      });

      await page.goto('/ro/pro', { waitUntil: 'domcontentloaded' });
      const consentBox = page.locator('input[type="checkbox"]');
      await expect(consentBox).toBeVisible({ timeout: 15_000 });
      await consentBox.check();

      await page
        .getByRole('button', { name: /activează|abonează|pro/i })
        .last()
        .click();

      // Reauth sheet appears (NOT guest mode) and checkout has NOT fired
      const gate = page.getByTestId('payment-auth-gate');
      await expect(gate).toBeVisible({ timeout: 5_000 });
      await expect(gate).toHaveAttribute('data-mode', 'reauth');
      await expect(gate).toContainText('Confirmă-ți contul ca să plătești');
      await expect(gate).toContainText(email);
      expect(checkoutCalls).toBe(0);

      // Step into email login
      await page.getByTestId('payment-gate-email-btn').click();
      await page.locator('input[type="password"]').fill('Secret123!');

      // Attempt 1: foreign uid -> error shown, no checkout, local session untouched
      await page.getByTestId('payment-gate-email-submit').click();
      await expect(gate.getByRole('alert')).toBeVisible({ timeout: 5_000 });
      expect(checkoutCalls).toBe(0);
      const storedAfterForeign = await page.evaluate(() =>
        JSON.parse(window.localStorage.getItem('ronduel_session_v1') || '{}'),
      );
      expect(storedAfterForeign.uid).toBe(ronduelUid);

      // Attempt 2: matching account -> exchange succeeds -> checkout fires with aligned Bearer token!
      await page.getByTestId('payment-gate-email-submit').click();
      await expect.poll(() => checkoutCalls, { timeout: 10_000 }).toBe(1);
      expect(checkoutAuth).toBe(`Bearer ${alignedJwt}`);
    });

    test('guest on /ro/pro sees guest PaymentAuthGate and never calls checkout', async ({
      page,
    }) => {
      let checkoutCalls = 0;

      await page.addInitScript(() => {
        window.sessionStorage.setItem('ronduel_splash_seen_v2', '1');
        window.localStorage.setItem('rd_last_active_at', String(Date.now()));
        window.localStorage.setItem(
          'ronduel_session_v1',
          JSON.stringify({
            uid: 'u_guest_ro_pro',
            nickname: 'GuestRO',
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
            uid: 'u_guest_ro_pro',
            isAnonymous: true,
            pro: { active: false },
          }),
        });
      });
      await page.route('**/api/billing/checkout**', async (route) => {
        checkoutCalls += 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      });

      await page.goto('/ro/pro', { waitUntil: 'domcontentloaded' });
      const consentBox = page.locator('input[type="checkbox"]');
      await expect(consentBox).toBeVisible({ timeout: 15_000 });
      await consentBox.check();
      await page
        .getByRole('button', { name: /activează|abonează|pro/i })
        .last()
        .click();

      const gate = page.getByTestId('payment-auth-gate');
      await expect(gate).toBeVisible({ timeout: 5_000 });
      await expect(gate).toHaveAttribute('data-mode', 'guest');
      await expect(gate).toContainText('Creează un cont ca să îți păstrezi datele');
      expect(checkoutCalls).toBe(0);
    });
  });
}
