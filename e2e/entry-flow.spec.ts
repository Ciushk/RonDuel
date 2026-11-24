import { expect, test } from '@playwright/test';

test.describe('New Entry Flow, League Preview & Join Experience', () => {
  test('1. Invite link (/[locale]/l/CODE) skips splash and displays League Preview page with sticky header, admin name, players table & locked scores', async ({
    page,
    request,
  }) => {
    // 1. Create a demo league via API
    const uid = `u_admin_demo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const createRes = await request.post('/api/leagues', {
      data: {
        uid,
        name: 'Campioni Trivia',
        themeEmoji: '⚡',
        themeColor: 'volt',
        plan: 'free',
      },
    });
    expect(createRes.status()).toBe(200);
    const leagueData = await createRes.json();
    const code = leagueData.inviteCode as string;

    // 2. Visit /ro/l/[code]
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/ro/l/${code}`);

    // Verify splash screen was skipped (pwa-splash should not be visible or unmounted)
    const splash = page.getByTestId('pwa-splash');
    await expect(splash).toHaveCount(0);

    // Sticky header: name and theme emoji
    await expect(page.getByText('Campioni Trivia')).toBeVisible();
    await expect(page.getByText('⚡')).toBeVisible();

    // League info: member count (1/5 jucători), Admin, Created date
    await expect(page.getByText('1/5 jucători')).toBeVisible();
    await expect(page.getByText(/Admin:/)).toBeVisible();
    await expect(page.getByText(/Creată pe/)).toBeVisible();

    // Players table: shows admin nickname, rank #1, total points, and score today locked (🔒) since viewer has not played
    await expect(page.getByText('#1')).toBeVisible();
    await expect(page.getByText('🔒')).toBeVisible();

    // Join button is visible and active
    const joinBtn = page.getByRole('button', { name: 'Alătură-te ligii' }).first();
    await expect(joinBtn).toBeVisible();
  });

  test('2. Invalid invite code displays friendly error and back button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ro/l/INVALID99');

    await expect(page.getByText('Codul de invitație nu e valid')).toBeVisible({ timeout: 10_000 });
    const backBtn = page.getByRole('button', { name: 'Înapoi' });
    await expect(backBtn).toBeVisible({ timeout: 5_000 });
    await backBtn.click();
    await expect(page).toHaveURL(/\/ro/, { timeout: 8_000 });
  });

  test('3. Join flow: 4-bullet explanation, 16+ checkbox required, validates room, saves nickname and redirects to full league', async ({
    page,
    request,
  }) => {
    // Create league
    const creatorUid = `u_creator_join_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const createRes = await request.post('/api/leagues', {
      data: {
        uid: creatorUid,
        name: 'Liga Prietenilor',
        themeEmoji: '🧠',
        plan: 'free',
      },
    });
    const { inviteCode } = await createRes.json();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/ro/l/${inviteCode}`);

    // Click "Alătură-te ligii"
    await page.getByRole('button', { name: 'Alătură-te ligii' }).first().click();

    // Bottom sheet dialog opens with title "Intră în Liga Prietenilor"
    await expect(page.getByRole('heading', { name: 'Intră în Liga Prietenilor' })).toBeVisible();

    // 4-bullet explanation is visible
    await expect(page.getByText('Ce se întâmplă acum:')).toBeVisible();
    await expect(
      page.getByText(/Intri în liga Liga Prietenilor și apari în clasament/),
    ).toBeVisible();
    await expect(page.getByText(/În fiecare zi e o rundă nouă: 6 întrebări/)).toBeVisible();
    await expect(page.getByText(/Scorul tău contează în toate ligile în care ești/)).toBeVisible();
    await expect(page.getByText(/Scorurile celorlalți de azi le vezi după ce joci/)).toBeVisible();

    // Checkbox is unchecked by default
    const ageCheckbox = page.getByRole('checkbox', { name: 'Am cel puțin 16 ani' });
    await expect(ageCheckbox).not.toBeChecked();

    const confirmJoinBtn = page.getByRole('button', { name: 'Intră în ligă' });
    await expect(confirmJoinBtn).toBeDisabled();

    // Check 16+ checkbox
    await ageCheckbox.check();
    await expect(confirmJoinBtn).toBeEnabled();

    // Fill custom nickname
    const nickInput = page.getByRole('textbox', { name: 'Poreclă' });
    await nickInput.fill('Mihai_Joiner');

    // Submit join
    await confirmJoinBtn.click();

    // Expect toast & redirect (to play with returnTo or directly to league)
    await expect(page.getByText(/Ai intrat în Liga Prietenilor ✓/)).toBeVisible();
    await expect(page).toHaveURL(/\/ro\/(league|play)/, { timeout: 8_000 });

    if (page.url().includes('/play')) {
      const returnTo = new URL(page.url()).searchParams.get('returnTo');
      if (returnTo) await page.goto(returnTo);
    }

    // On full league page: verify code is visible, invite copy/share buttons exist
    await expect(page.getByText('Cod de invitație')).toBeVisible();
    await expect(page.getByText('Copiază linkul')).toBeVisible();
    await expect(page.getByText('Trimite invitația')).toBeVisible();

    // Switch to all-time tab to verify join date is rendered
    await page.getByRole('tab', { name: 'All-time' }).click();
    await expect(page.getByText(/S-a alăturat pe/).first()).toBeVisible();
  });

  test('4. Full league owner management: rename, regenerate code, private approval toggle, and delete', async ({
    page,
    request,
  }) => {
    const sUid = `u_owner_full_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const createRes = await request.post('/api/leagues', {
      data: {
        uid: sUid,
        name: 'Liga Pro Test',
        themeEmoji: '👑',
        plan: 'pro_trial', // Pro league allows regenerate code & private approval
      },
    });
    const { id } = await createRes.json();

    // Set local session so viewer is the owner
    await page.addInitScript((uid) => {
      window.localStorage.setItem(
        'ronduel_session_v1',
        JSON.stringify({
          uid,
          nickname: 'KingOwner',
          ageConfirmed16: true,
          theme: 'light',
          isAnonymous: false,
          authProvider: 'google',
        }),
      );
    }, sUid);

    await page.goto(`/ro/league/${id}`);

    // Verify owner controls
    await expect(page.getByRole('button', { name: 'Redenumește' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Regenerează codul' })).toBeVisible();
    await expect(page.getByText('Aprobare privată pentru membri noi')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Șterge liga' })).toBeVisible();

    // Toggle private approval
    const approvalCheckbox = page.getByRole('checkbox', {
      name: 'Aprobare privată pentru membri noi',
    });
    await approvalCheckbox.click();
    await expect(page.getByText('Aprobare privată activată')).toBeVisible();
  });
});
