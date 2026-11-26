import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PLAY_ID = 'play_e2e_done_1';

function buildStatusPayload(played: boolean) {
  return {
    roundId: '2026-11-26',
    roundNumber: 42,
    themeKey: 'worldScience',
    played,
    inProgress: !played,
    playId: played ? PLAY_ID : undefined,
    score: played ? 940 : undefined,
    totalScore: played ? 940 : undefined,
    emojiLine: played ? '⚡🟩🟩⚡🟩🟩' : undefined,
    streakCurrent: 6,
    streakAtRisk: false,
    finishedPlaysCount: played ? 6 : 5,
    isPro: false,
    nickname: 'Tester',
    ageConfirmed16: true,
    worldLeague: {
      id: 'lg_world',
      name: 'RonDuel World',
      inviteCode: 'WORLD',
      membersCount: 180,
      playedTodayCount: 74,
      myRankToday: played ? 4 : null,
      isWorld: true,
    },
    privateLeagues: [],
    duels: [],
    activeDuelsCount: 0,
    maxActiveDuels: 1,
    monthlyDuelsCount: 0,
    maxMonthlyDuels: 4,
  };
}

test.describe('Home "done for today" state', () => {
  test('finishing a round opens result, reopening /en shows done-for-today with countdown + tiles, /play redirects to /en, and See results opens result', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    let played = false;

    await page.addInitScript(() => {
      window.localStorage.setItem(
        'ronduel_session_v1',
        JSON.stringify({
          uid: 'u_e2e_home_done',
          nickname: 'Tester',
          ageConfirmed16: true,
          isAnonymous: false,
          analyticsConsent: 'denied',
          theme: 'light',
        }),
      );
      window.localStorage.setItem('rd_home_banner_dismissed', 'true');
    });

    await page.route('**/api/game/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildStatusPayload(played)),
      });
    });

    await page.route('**/api/game/start', async (route) => {
      if (played) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ alreadyFinished: true, playId: PLAY_ID }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          playId: PLAY_ID,
          totalItems: 1,
          remainingMs: 30000,
          item: {
            index: 0,
            type: 'mcq',
            prompt: 'Which planet is known as the Red Planet?',
            options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
            limitMs: 30000,
          },
        }),
      });
    });

    await page.route('**/api/game/answer', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          correct: true,
          correctIndex: 1,
          points: 200,
          next: null,
        }),
      });
    });

    await page.route('**/api/game/finish', async (route) => {
      played = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, playId: PLAY_ID }),
      });
    });

    await page.route(`**/api/game/result/${PLAY_ID}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          playId: PLAY_ID,
          date: '2026-11-26',
          roundNumber: 42,
          totalScore: 940,
          totalMs: 14200,
          emojiLine: '⚡🟩🟩⚡🟩🟩',
          streakCurrent: 6,
          streakBest: 6,
          review: [],
          leagueRanks: [],
          primaryLeague: null,
        }),
      });
    });

    // 1. Play and finish today's round -> MUST still open /en/result/{playId}
    await page.goto('/en/play');
    await expect(page.getByText('Which planet is known as the Red Planet?')).toBeVisible();
    await page.getByRole('button', { name: /Mars/i }).click();
    await page.waitForURL(new RegExp(`/en/result/${PLAY_ID}`), { timeout: 10000 });

    // 2. Simulate reopening the app (clear splash session flag) on /en -> stays on /en
    await page.evaluate(() => {
      window.sessionStorage.removeItem('ronduel_splash_seen');
    });
    await page.goto('/en');

    // Wait for splash to finish and confirm home done state is shown (no redirect to /result)
    await expect(page.getByTestId('home-done-card')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(1600);
    expect(new URL(page.url()).pathname).toBe('/en');

    await expect(page.getByTestId('home-round-complete-chip')).toContainText(
      "Today's round complete",
    );
    await expect(page.getByTestId('home-done-score')).toHaveText('940');

    const countdownEl = page.getByTestId('home-next-countdown');
    const firstTick = (await countdownEl.textContent())?.trim() ?? '';
    expect(firstTick).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    await page.waitForTimeout(1200);
    const secondTick = (await countdownEl.textContent())?.trim() ?? '';
    expect(secondTick).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(secondTick).not.toBe(firstTick);

    const townTile = page.getByTestId('home-town-tile');
    const duelsTile = page.getByTestId('home-duels-tile');
    await expect(townTile).toBeVisible();
    await expect(duelsTile).toBeVisible();
    await expect(page.getByTestId('home-town-entry-card')).toHaveCount(0);

    // Both sticker tiles must sit comfortably above the bottom nav on 390x844
    const townBox = await townTile.boundingBox();
    const duelsBox = await duelsTile.boundingBox();
    expect(townBox).not.toBeNull();
    expect(duelsBox).not.toBeNull();
    expect(townBox!.y + townBox!.height).toBeLessThan(844 - 64);
    expect(duelsBox!.y + duelsBox!.height).toBeLessThan(844 - 64);

    // Optional screenshot capture when requested via env var
    if (process.env.HOME_DONE_SCREENSHOT_PATH) {
      await page.screenshot({
        path: process.env.HOME_DONE_SCREENSHOT_PATH,
        fullPage: false,
      });
    }

    // Axe accessibility check on /en played state
    const axeResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const seriousOrCritical = axeResults.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(seriousOrCritical).toEqual([]);

    // 3. Direct visit to /en/play after playing redirects to /en (never reopens /result)
    await page.goto('/en/play');
    await page.waitForURL((url) => url.pathname === '/en', { timeout: 8000 });
    await expect(page.getByTestId('home-done-card')).toBeVisible();

    // 4. Tapping "See results →" explicitly opens /en/result/{playId}
    await page.getByTestId('home-see-results-link').click();
    await page.waitForURL(new RegExp(`/en/result/${PLAY_ID}`), { timeout: 8000 });
  });
});
