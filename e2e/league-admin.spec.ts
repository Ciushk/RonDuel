import { expect, test } from '@playwright/test';
import path from 'node:path';

test.describe('Manage League i18n (ro/en/de at 390px) and Rename Persistence', () => {
  const LOCALES = [
    {
      locale: 'ro',
      theme: 'dark',
      backText: 'Înapoi la clasament',
      ownerText: 'Proprietar',
      proTitle: 'Setări Pro',
      inviteHeading: 'Cod și link de invitație',
    },
    {
      locale: 'en',
      theme: 'light',
      backText: 'Back to leaderboard',
      ownerText: 'Owner',
      proTitle: 'Pro settings',
      inviteHeading: 'Invite code and link',
    },
    {
      locale: 'de',
      theme: 'light',
      backText: 'Zurück zur Rangliste',
      ownerText: 'Eigentümer',
      proTitle: 'Pro-Einstellungen',
      inviteHeading: 'Einladungscode und Link',
    },
  ] as const;

  for (const cfg of LOCALES) {
    test(`Manage League renders fully translated with zero raw league.* keys in [${cfg.locale}] at 390px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });

      await page.addInitScript((theme: string) => {
        window.localStorage.setItem(
          'ronduel_session_v1',
          JSON.stringify({
            uid: 'u_e2e_owner',
            nickname: 'Andrei',
            email: 'andrei@example.com',
            ageConfirmed16: true,
            isAnonymous: false,
            analyticsConsent: 'denied',
            theme,
          }),
        );
        window.sessionStorage.setItem('ronduel_splash_seen_v2', '1');
      }, cfg.theme);

      await page.route('**/api/leagues/lg_e2e_1**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'lg_e2e_1',
            name: 'Prietenii de la cafea',
            inviteCode: 'CAFE99',
            ownerUid: 'u_e2e_owner',
            adminName: 'Andrei',
            themeEmoji: '🏆',
            themeColor: 'volt',
            memberCount: 2,
            maxMembers: 200,
            isOwner: true,
            isMember: true,
            privateApproval: true,
            allTime: [
              {
                uid: 'u_e2e_owner',
                nickname: 'Andrei',
                joinedAt: '2026-11-01T10:00:00Z',
                allTimeScore: 1450,
                roundsPlayed: 6,
              },
              {
                uid: 'u_e2e_friend',
                nickname: 'Maria',
                joinedAt: '2026-11-05T10:00:00Z',
                allTimeScore: 1210,
                roundsPlayed: 5,
              },
            ],
            todayScores: [],
          }),
        });
      });

      await page.route('**/api/game/status**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ isPro: true, played: false, roundNumber: 42 }),
        });
      });

      await page.goto(`/${cfg.locale}/league/lg_e2e_1/admin`);

      await expect(page.getByTestId('admin-league-name')).toHaveText('Prietenii de la cafea', {
        timeout: 10000,
      });
      await expect(page.getByTestId('admin-rename-input')).toHaveValue('Prietenii de la cafea');

      const mainText = (await page.locator('main').textContent()) ?? '';
      expect(mainText).not.toMatch(/\bleague\.[a-zA-Z]+/);
      expect(mainText).not.toContain('undefined');
      expect(mainText).toContain(cfg.backText);
      expect(mainText).toContain(cfg.ownerText);
      expect(mainText).toContain(cfg.proTitle);
      expect(mainText).toContain(cfg.inviteHeading);

      if (process.env.MANAGE_LEAGUE_SCREENSHOT_DIR) {
        await page.screenshot({
          path: path.join(
            process.env.MANAGE_LEAGUE_SCREENSHOT_DIR,
            `manage_league_${cfg.locale}_390.png`,
          ),
          fullPage: true,
        });
      }
    });
  }

  test('renaming a league updates admin header, league page header, and leaderboard without full reload, and rejects "undefined"', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    let currentName = 'Old Coffee Crew';

    await page.addInitScript(() => {
      window.localStorage.setItem(
        'ronduel_session_v1',
        JSON.stringify({
          uid: 'u_e2e_owner',
          nickname: 'Andrei',
          email: 'andrei@example.com',
          ageConfirmed16: true,
          isAnonymous: false,
          analyticsConsent: 'denied',
          theme: 'light',
          leagueIds: ['lg_e2e_rename'],
        }),
      );
      window.sessionStorage.setItem('ronduel_splash_seen_v2', '1');
    });

    await page.route('**/api/leagues/lg_e2e_rename**', async (route) => {
      const req = route.request();
      if (req.method() === 'PATCH') {
        const body = req.postDataJSON() as { name?: string };
        const trimmed = String(body.name ?? '').trim();
        if (trimmed.toLowerCase() === 'undefined' || trimmed.length < 2) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'LEAGUE_NAME_INVALID', error: 'Invalid league name' }),
          });
          return;
        }
        currentName = trimmed;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, name: currentName }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'lg_e2e_rename',
          name: currentName,
          inviteCode: 'RENM99',
          ownerUid: 'u_e2e_owner',
          adminName: 'Andrei',
          themeEmoji: '🏆',
          themeColor: 'volt',
          memberCount: 2,
          maxMembers: 5,
          isOwner: true,
          isMember: true,
          privateApproval: false,
          viewerFinishedToday: true,
          allTime: [
            {
              uid: 'u_e2e_owner',
              nickname: 'Andrei',
              joinedAt: '2026-11-01T10:00:00Z',
              allTimeScore: 1450,
              roundsPlayed: 6,
            },
          ],
          todayScores: [],
        }),
      });
    });

    await page.route('**/api/game/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isPro: false,
          played: true,
          roundNumber: 42,
          worldLeague: {
            id: 'lg_world',
            name: 'RonDuel World',
            memberCount: 100,
            playedTodayCount: 40,
          },
          privateLeagues: [
            {
              id: 'lg_e2e_rename',
              name: currentName,
              inviteCode: 'RENM99',
              ownerUid: 'u_e2e_owner',
              isOwner: true,
              memberCount: 2,
              maxMembers: 5,
              playedTodayCount: 1,
            },
          ],
          leaguesLeaderboard: [
            {
              id: 'lg_e2e_rename',
              name: currentName,
              themeEmoji: '🏆',
              themeColor: 'volt',
              memberCount: 2,
              maxMembers: 5,
              playedTodayCount: 1,
              totalPoints: 800,
              allTimePoints: 1450,
              avgScore: 800,
              rank: 1,
            },
          ],
        }),
      });
    });

    // 1. Open Manage League admin
    await page.goto('/en/league/lg_e2e_rename/admin');
    await expect(page.getByTestId('admin-league-name')).toHaveText('Old Coffee Crew', {
      timeout: 10000,
    });

    // 2. Submitting "undefined" shows error toast and keeps old name
    await page.getByTestId('admin-rename-input').fill('undefined');
    await page.getByTestId('admin-rename-submit').click();
    await expect(page.getByTestId('admin-toast')).toContainText(
      'League name must be between 2 and 30 characters.',
    );
    await expect(page.getByTestId('admin-league-name')).toHaveText('Old Coffee Crew');

    // 3. Valid rename updates admin header immediately
    await page.getByTestId('admin-rename-input').fill('Espresso Elite');
    await page.getByTestId('admin-rename-submit').click();
    await expect(page.getByTestId('admin-league-name')).toHaveText('Espresso Elite');
    await expect(page.getByTestId('admin-toast')).toContainText('League name updated!');

    // 4. Click "Back to leaderboard" -> league page header shows the NEW name without full reload
    await page.getByRole('link', { name: 'Back to leaderboard' }).click();
    await page.waitForURL('**/en/league/lg_e2e_rename', { timeout: 10000 });
    await expect(page.getByTestId('league-header-name')).toHaveText('Espresso Elite');

    // 5. Navigate to Leagues Leaderboard -> shows NEW name
    await page.goto('/en/leagues?tab=leaderboard&sub=leagues');
    await expect(page.getByText('Espresso Elite')).toBeVisible({ timeout: 10000 });
  });
});
