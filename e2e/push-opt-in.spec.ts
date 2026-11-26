import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Web Push opt-in card, Profile toggle & Service Worker handlers', () => {
  test('/sw.js contains push and notificationclick handlers', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain("addEventListener('push'");
    expect(text).toContain("addEventListener('notificationclick'");
    expect(text).toContain('showNotification');
  });

  test('Profile page shows disabled toggle and blocked help when notifications are denied (WCAG AA)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.addInitScript(() => {
      window.localStorage.setItem(
        'ronduel_session_v1',
        JSON.stringify({
          uid: 'u_e2e_push_denied',
          nickname: 'Tester',
          email: 'tester@example.com',
          ageConfirmed16: true,
          isAnonymous: false,
          analyticsConsent: 'denied',
          theme: 'light',
        }),
      );
      window.sessionStorage.setItem('ronduel_splash_seen_v2', '1');
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: {
          permission: 'denied',
          requestPermission: () => Promise.resolve('denied'),
        },
      });
    });

    await page.route('**/api/me/profile**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          uid: 'u_e2e_push_denied',
          nickname: 'Tester',
          email: 'tester@example.com',
          isAnonymous: false,
          authProvider: 'password',
          isAdmin: false,
          pro: { active: false },
          notif: { pushEnabled: false, emailEnabled: false, reminderLocalTime: '18:00' },
          streakCurrent: 3,
          streakBest: 5,
          freezes: 0,
          playedDates: [],
          topicAccuracy: [],
        }),
      });
    });

    await page.goto('/en/me');

    const blocked = page.getByTestId('profile-push-blocked');
    await expect(blocked).toBeVisible({ timeout: 8000 });
    await expect(blocked).toContainText('Notifications are blocked for RonDuel.');

    const axeResults = await new AxeBuilder({ page })
      .include('[data-testid="profile-push-blocked"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const seriousOrCritical = axeResults.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(seriousOrCritical).toEqual([]);
  });

  test('Home PushOptInCard renders with Split Court styling when VAPID key is configured', async ({
    page,
  }) => {
    test.skip(
      !process.env.EXPECT_PUSH_OPTIN_VISIBLE,
      'Set EXPECT_PUSH_OPTIN_VISIBLE=1 when built with NEXT_PUBLIC_FIREBASE_VAPID_KEY',
    );

    await page.setViewportSize({ width: 390, height: 844 });

    await page.addInitScript(() => {
      window.localStorage.setItem(
        'ronduel_session_v1',
        JSON.stringify({
          uid: 'u_e2e_push_card',
          nickname: 'Tester',
          email: 'tester@example.com',
          ageConfirmed16: true,
          isAnonymous: false,
          analyticsConsent: 'denied',
          theme: 'light',
        }),
      );
      window.localStorage.setItem('rd_home_banner_dismissed', 'true');
      window.sessionStorage.setItem('ronduel_splash_seen_v2', '1');
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: {
          permission: 'default',
          requestPermission: () => Promise.resolve('granted'),
        },
      });
    });

    await page.route('**/api/game/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          roundId: '2026-11-26',
          roundNumber: 42,
          themeKey: 'worldScience',
          played: false,
          inProgress: false,
          streakCurrent: 4,
          streakAtRisk: false,
          finishedPlaysCount: 4,
          isPro: false,
          nickname: 'Tester',
          ageConfirmed16: true,
          worldLeague: {
            id: 'lg_world',
            name: 'RonDuel World',
            inviteCode: 'WORLD',
            membersCount: 150,
            playedTodayCount: 42,
            myRankToday: null,
            isWorld: true,
          },
          privateLeagues: [],
          duels: [],
        }),
      });
    });

    await page.goto('/en');

    await expect(page.getByTestId('pwa-splash')).toBeHidden({ timeout: 5000 });
    const card = page.getByTestId('push-opt-in-card');
    await expect(card).toBeVisible({ timeout: 8000 });
    await expect(card).toContainText('Never miss the daily round');
    await expect(page.getByTestId('push-enable-btn')).toBeVisible();

    if (process.env.PUSH_OPTIN_SCREENSHOT_PATH) {
      await page.waitForTimeout(300);
      await page.screenshot({
        path: process.env.PUSH_OPTIN_SCREENSHOT_PATH,
        fullPage: false,
      });
    }

    const axeResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const seriousOrCritical = axeResults.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(seriousOrCritical).toEqual([]);
  });
});
