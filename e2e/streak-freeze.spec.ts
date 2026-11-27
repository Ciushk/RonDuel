import { expect, test } from '@playwright/test';

const TEST_UID = 'u_e2e_streak_1';
const TODAY = '2026-11-27';

function buildBaseSession() {
  return {
    uid: TEST_UID,
    nickname: 'Andrei',
    ageConfirmed16: true,
    isAnonymous: false,
    email: 'andrei@example.com',
    analyticsConsent: 'denied',
    theme: 'light',
  };
}

function buildStatus(overrides: Record<string, unknown> = {}) {
  return {
    date: TODAY,
    roundNumber: 42,
    themeKey: 'worldScience',
    topicOfTheDay: 'Science',
    played: false,
    inProgress: false,
    streakCurrent: 5,
    streakBest: 12,
    lastPlayedDate: '2026-11-25',
    freezes: 1,
    streakIncreasedToday: false,
    streakBeforeToday: 5,
    missedDays: 1,
    freezeAvailable: true,
    freezesNeeded: 1,
    canCoverMiss: true,
    weeklyShieldAvailable: false,
    streakAlive: false,
    streakAtRisk: false,
    freezeAutoUsed: false,
    freezeNotice: null,
    isPro: false,
    nickname: 'Andrei',
    ageConfirmed16: true,
    finishedPlaysCount: 5,
    weekStrip: [
      { date: '2026-11-23', weekday: 'L', state: 'played' },
      { date: '2026-11-24', weekday: 'M', state: 'played' },
      { date: '2026-11-25', weekday: 'M', state: 'played' },
      { date: '2026-11-26', weekday: 'J', state: 'missed' },
      { date: '2026-11-27', weekday: 'V', state: 'today' },
      { date: '2026-11-28', weekday: 'S', state: 'upcoming' },
      { date: '2026-11-29', weekday: 'D', state: 'upcoming' },
    ],
    worldLeague: {
      id: 'lg_world',
      name: 'RonDuel World',
      inviteCode: 'WORLD',
      memberCount: 180,
      playedTodayCount: 74,
      myRankToday: null,
    },
    privateLeagues: [],
    activeDuels: [],
    activeDuelsCount: 0,
    maxActiveDuels: 1,
    monthlyDuelsCount: 0,
    maxMonthlyDuels: 4,
    ...overrides,
  };
}

async function seedSession(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((session) => {
    window.sessionStorage.setItem('ronduel_splash_seen', '1');
    window.localStorage.setItem('ronduel_session_v1', JSON.stringify(session));
    window.localStorage.setItem('rd_home_banner_dismissed', 'true');
  }, buildBaseSession());
}

test.describe('Home streak animation, 7-day strip, missed-day card, and freeze flows', () => {
  test('RO: plays +1 streak animation once per day and skips it on reload', async ({ page }) => {
    await seedSession(page);

    await page.route('**/api/game/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildStatus({
            played: true,
            playId: `${TODAY}_${TEST_UID}`,
            score: 880,
            totalScore: 880,
            emojiLine: '⚡🟩🟩⚡🟩🟩',
            streakCurrent: 6,
            streakBeforeToday: 5,
            streakIncreasedToday: true,
            missedDays: 0,
            canCoverMiss: false,
            streakAlive: true,
            weekStrip: [
              { date: '2026-11-23', weekday: 'L', state: 'played' },
              { date: '2026-11-24', weekday: 'M', state: 'played' },
              { date: '2026-11-25', weekday: 'M', state: 'played' },
              { date: '2026-11-26', weekday: 'J', state: 'played' },
              { date: '2026-11-27', weekday: 'V', state: 'played' },
              { date: '2026-11-28', weekday: 'S', state: 'upcoming' },
              { date: '2026-11-29', weekday: 'D', state: 'upcoming' },
            ],
          }),
        ),
      });
    });

    await page.goto('/ro');
    await expect(page.getByTestId('home-streak-chip')).toBeVisible();
    await expect(page.getByTestId('home-streak-sr')).toContainText('Seria a ajuns la 6 zile.');
    await expect(page.getByTestId('home-week-strip')).toBeVisible();
    await expect(page.getByTestId('week-day-2026-11-27')).toHaveAttribute('data-state', 'played');

    const storedFlag = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      `rd_streak_anim_v1_${TEST_UID}_${TODAY}`,
    );
    expect(storedFlag).toBe('1');

    // Reload same day: animation must NOT replay
    await page.reload();
    await expect(page.getByTestId('home-streak-chip')).toBeVisible();
    await expect(page.getByTestId('home-streak-count')).toContainText('6');
    await expect(page.getByTestId('home-streak-plus-one')).toHaveCount(0);
  });

  test('EN reduced-motion: renders updated streak immediately without flame animation', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedSession(page);

    await page.route('**/api/game/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildStatus({
            played: true,
            playId: `${TODAY}_${TEST_UID}`,
            score: 880,
            totalScore: 880,
            streakCurrent: 6,
            streakBeforeToday: 5,
            streakIncreasedToday: true,
            missedDays: 0,
            canCoverMiss: false,
            streakAlive: true,
          }),
        ),
      });
    });

    await page.goto('/en');
    await expect(page.getByTestId('home-streak-chip')).toHaveAttribute('data-animating', 'false');
    await expect(page.getByTestId('home-streak-count')).toContainText('6');
    await expect(page.getByTestId('home-streak-sr')).toContainText('Streak grew to 6 days.');
  });

  test('Case A (RO): 1 missed day + 1 freeze -> clicking Use streak freeze turns cell to frozen and removes card', async ({
    page,
  }) => {
    await seedSession(page);

    let freezeApplied = false;

    await page.route('**/api/game/status**', async (route) => {
      const payload = freezeApplied
        ? buildStatus({
            missedDays: 0,
            freezes: 0,
            canCoverMiss: false,
            freezeAvailable: false,
            streakAlive: true,
            lastPlayedDate: '2026-11-26',
            weekStrip: [
              { date: '2026-11-23', weekday: 'L', state: 'played' },
              { date: '2026-11-24', weekday: 'M', state: 'played' },
              { date: '2026-11-25', weekday: 'M', state: 'played' },
              { date: '2026-11-26', weekday: 'J', state: 'frozen' },
              { date: '2026-11-27', weekday: 'V', state: 'today' },
              { date: '2026-11-28', weekday: 'S', state: 'upcoming' },
              { date: '2026-11-29', weekday: 'D', state: 'upcoming' },
            ],
          })
        : buildStatus();

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      });
    });

    await page.route('**/api/game/use-freeze', async (route) => {
      freezeApplied = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          noop: false,
          streakCurrent: 5,
          freezes: 0,
          lastPlayedDate: '2026-11-26',
          coveredDate: '2026-11-26',
        }),
      });
    });

    await page.goto('/ro');
    await expect(page.getByTestId('missed-day-card')).toHaveAttribute('data-missed-case', 'A');
    await expect(page.getByTestId('week-day-2026-11-26')).toHaveAttribute('data-state', 'missed');

    await page.getByTestId('missed-use-freeze-btn').click();
    await expect(page.getByTestId('missed-day-card')).toHaveCount(0);
    await expect(page.getByTestId('week-day-2026-11-26')).toHaveAttribute('data-state', 'frozen');
    await expect(page.getByTestId('home-streak-count')).toContainText('5');
  });

  test('Auto-apply toast (RO): returning home after auto-applied freeze shows localized freezeAutoUsed toast', async ({
    page,
  }) => {
    await seedSession(page);

    await page.route('**/api/game/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildStatus({
            played: true,
            playId: `${TODAY}_${TEST_UID}`,
            score: 760,
            totalScore: 760,
            streakCurrent: 6,
            streakBeforeToday: 5,
            streakIncreasedToday: true,
            missedDays: 0,
            freezes: 0,
            canCoverMiss: false,
            streakAlive: true,
            freezeAutoUsed: true,
          }),
        ),
      });
    });

    await page.goto('/ro');
    await expect(page.getByText(/Un îngheț ți-a salvat seria de 6 zile/i)).toBeVisible();
  });

  test('Case B (EN): 1 missed day + 0 freezes + non-Pro shows Buy a freeze & Pro upsell', async ({
    page,
  }) => {
    await seedSession(page);

    await page.route('**/api/game/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildStatus({
            missedDays: 1,
            freezes: 0,
            canCoverMiss: false,
            freezeAvailable: false,
            isPro: false,
          }),
        ),
      });
    });

    await page.goto('/en');
    await expect(page.getByTestId('missed-day-card')).toHaveAttribute('data-missed-case', 'B');
    await expect(page.getByTestId('missed-use-freeze-btn')).toHaveCount(0);
    await expect(page.getByTestId('missed-buy-freeze-btn')).toBeVisible();
    await expect(page.getByTestId('missed-go-pro-btn')).toBeVisible();

    await page.getByTestId('missed-buy-freeze-btn').click();
    await expect(page.getByTestId('home-buy-freeze-1')).toContainText('0,99 €');
    await expect(page.getByTestId('home-buy-freeze-3')).toContainText('1,99 €');
  });

  test('Case C (EN): 2+ missed days even with 2 freezes hides freeze CTAs and allows Reset streak', async ({
    page,
  }) => {
    await seedSession(page);

    let wasReset = false;

    await page.route('**/api/game/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wasReset
            ? buildStatus({
                streakCurrent: 0,
                missedDays: 0,
                freezes: 2,
                canCoverMiss: false,
                freezeAvailable: false,
              })
            : buildStatus({
                streakCurrent: 7,
                missedDays: 2,
                freezes: 2,
                canCoverMiss: false,
                freezeAvailable: false,
                freezesNeeded: 0,
              }),
        ),
      });
    });

    await page.route('**/api/game/reset-streak', async (route) => {
      wasReset = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, streakCurrent: 0, streakBest: 12, freezes: 2 }),
      });
    });

    await page.goto('/en');
    await expect(page.getByTestId('missed-day-card')).toHaveAttribute('data-missed-case', 'C');
    await expect(page.getByTestId('missed-use-freeze-btn')).toHaveCount(0);
    await expect(page.getByTestId('missed-buy-freeze-btn')).toHaveCount(0);

    await page.getByTestId('missed-reset-btn').click();
    await page.getByTestId('missed-reset-confirm-btn').click();
    await expect(page.getByTestId('missed-day-card')).toHaveCount(0);
  });
});
