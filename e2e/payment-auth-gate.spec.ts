import { expect, test } from '@playwright/test';

const FIREBASE_API_KEY = 'AIzaSyC1xcAcVnO71-zdXjQE_7RYurgGw-bnE0o';

test.describe('PaymentAuthGate on /en/pro', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block',
    launchOptions: { args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-gpu'] },
  });

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
