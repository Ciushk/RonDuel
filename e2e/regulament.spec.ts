import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const EXPECTED_ANCHORS = [
  'ce-este',
  'runda',
  'o-incercare',
  'punctaj',
  'egalitati',
  'clasamente',
  'ligi',
  'dueluri',
  'serii',
  'trisat',
  'erori',
  'pro',
  'modificari',
  'contact',
];

test.describe('Regulamentul de joc RonDuel (/ro/regulament & translated locales)', () => {
  test('1 & 2. GET /ro/regulament renders verbatim text, 14 article anchors, DRAFT banner, <mark> placeholders, noindex, and passes axe in light & dark mode', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const res = await page.goto('/ro/regulament');
    expect(res?.status()).toBe(200);

    // Title & meta description
    await expect(page).toHaveTitle('Regulamentul jocului | RonDuel');
    const metaDesc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(metaDesc).toBe(
      'Cum funcționează RonDuel: runda zilnică, calculul punctelor, egalități, ligi, dueluri, serii, trișat și ce include Pro. Fără premii, fără jocuri de noroc.',
    );

    // Robots noindex when placeholders exist
    const robotsMeta = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robotsMeta).toContain('noindex');

    // DRAFT banner visible
    const draftBanner = page.getByTestId('legal-draft-banner');
    await expect(draftBanner).toBeVisible();
    await expect(draftBanner).toHaveText('DRAFT – textul juridic nu este final');

    // H1 & 14 H2 articles with exact anchor IDs
    await expect(
      page.getByRole('heading', { level: 1, name: 'Regulamentul de joc RonDuel' }),
    ).toBeVisible();
    const h2Count = await page.locator('article h2').count();
    expect(h2Count).toBe(14);

    for (const anchor of EXPECTED_ANCHORS) {
      await expect(page.locator(`h2#${anchor}`)).toBeVisible();
    }

    // "Ultima actualizare" appears twice (top and bottom)
    const bodyText = (await page.locator('article').textContent()) ?? '';
    const matches = bodyText.match(/Ultima actualizare:/g) ?? [];
    expect(matches.length).toBe(2);

    // Bracketed placeholders rendered in <mark>
    const markCount = await page.locator('article mark').count();
    expect(markCount).toBeGreaterThanOrEqual(10);
    await expect(page.locator('article mark').first()).toContainText('[DATA]');

    // Formula rendered inside blockquote > code
    await expect(page.locator('article blockquote code')).toContainText(
      'bonus = round( 100 × max(0, (limită − timp) / limită) )',
    );

    // Axe accessibility check in light mode
    const lightAxe = await new AxeBuilder({ page }).analyze();
    expect(lightAxe.violations).toEqual([]);

    // Screenshot light mode
    await page.screenshot({
      path: 'test-results/screenshots/regulament-ro-light.png',
      fullPage: false,
    });

    // Switch to dark mode and run axe
    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const darkAxe = await new AxeBuilder({ page }).analyze();
    expect(darkAxe.violations).toEqual([]);

    await page.screenshot({
      path: 'test-results/screenshots/regulament-ro-dark.png',
      fullPage: false,
    });
  });

  test('Translated /en/regulament, /es/regulament, /pt/regulament also render 14 articles and DRAFT banner', async ({
    page,
  }) => {
    for (const [loc, h1Text] of [
      ['en', 'RonDuel Game Rules'],
      ['es', 'Reglamento del juego RonDuel'],
      ['pt', 'Regulamento do jogo RonDuel'],
    ] as const) {
      const r = await page.goto(`/${loc}/regulament`);
      expect(r?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: h1Text })).toBeVisible();
      expect(await page.locator('article h2').count()).toBe(14);
      await expect(page.getByTestId('legal-draft-banner')).toBeVisible();
    }
  });

  test('3 & 4 & 5. Links on /ro hero, footer, result screen (#punctaj), league page (#ligi), duel page (#dueluri), Pro paywall (#pro), and none on /ro/play', async ({
    page,
    request,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ro');

    // Wait for splash screen to fade out
    await page.waitForTimeout(1300);

    // Hero CTA unchanged & "Regulamentul jocului" link directly below it
    const ctaBtn = page.getByRole('button', { name: 'Joacă runda de azi' }).first();
    await expect(ctaBtn).toBeVisible();

    const heroRulesLink = page.getByTestId('hero-rules-link');
    await expect(heroRulesLink).toBeVisible();
    await expect(heroRulesLink).toHaveText('Regulamentul jocului');
    await expect(heroRulesLink).toHaveAttribute('href', '/ro/regulament');

    // Check tap target >= 44px and DOM order (link is directly after CTA button)
    const linkBox = await heroRulesLink.boundingBox();
    expect(linkBox).not.toBeNull();
    expect(linkBox!.height).toBeGreaterThanOrEqual(44);

    const ctaBox = await ctaBtn.boundingBox();
    expect(ctaBox).not.toBeNull();
    expect(linkBox!.y).toBeGreaterThanOrEqual(ctaBox!.y + ctaBox!.height);

    // Keyboard focusable
    await heroRulesLink.focus();
    await expect(heroRulesLink).toBeFocused();

    // Axe check on /ro
    const roAxe = await new AxeBuilder({ page }).analyze();
    expect(roAxe.violations).toEqual([]);

    // Screenshot /ro hero light & dark
    await page.screenshot({
      path: 'test-results/screenshots/hero-ro-light.png',
      fullPage: false,
    });
    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await page.screenshot({
      path: 'test-results/screenshots/hero-ro-dark.png',
      fullPage: false,
    });
    await page.getByRole('button', { name: 'Toggle theme' }).click();

    // Footer link next to "Termeni și condiții"
    const footerRulesLink = page
      .locator('footer')
      .getByRole('link', { name: 'Regulamentul jocului' });
    await expect(footerRulesLink).toBeVisible();
    await expect(footerRulesLink).toHaveAttribute('href', '/ro/regulament');

    // Pro paywall link -> /ro/regulament#pro
    await page.goto('/ro/pro');
    const proRulesLink = page.getByTestId('pro-rules-link');
    await expect(proRulesLink).toBeVisible();
    await expect(proRulesLink).toHaveText('Ce include Pro și ce nu');
    await expect(proRulesLink).toHaveAttribute('href', '/ro/regulament#pro');
    await page.screenshot({
      path: 'test-results/screenshots/pro-ro-light.png',
      fullPage: false,
    });
    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await page.screenshot({
      path: 'test-results/screenshots/pro-ro-dark.png',
      fullPage: false,
    });
    await page.getByRole('button', { name: 'Toggle theme' }).click();

    // Seed a finished play, league, and duel via API to verify Result, League, and Duel links
    const uid = `u_rules_${testInfo.project.name}_${Date.now()}`;
    const startRes = await request.post('/api/game/start', {
      data: { uid, tz: 'Europe/Bucharest', locale: 'ro', nickname: 'Ștefan' },
    });
    const startData = await startRes.json();
    const playId = startData.playId as string;

    // Verify no rules link on in-round game screen (/ro/play)
    await page.goto('/ro/play');
    await expect(page.locator('a[href*="/regulament"]')).toHaveCount(0);

    for (let idx = 0; idx < 6; idx += 1) {
      await request.post('/api/game/answer', {
        data: { uid, playId, index: idx, choice: 0 },
      });
    }
    await request.post('/api/game/finish', { data: { uid, playId } });

    // Result screen link -> /ro/regulament#punctaj
    await page.goto(`/ro/result/${encodeURIComponent(playId)}`);
    const resultRulesLink = page.getByTestId('result-rules-link');
    await expect(resultRulesLink).toBeVisible();
    await expect(resultRulesLink).toHaveText('Cum se calculează punctele?');
    await expect(resultRulesLink).toHaveAttribute('href', '/ro/regulament#punctaj');
    await page.screenshot({
      path: 'test-results/screenshots/result-ro-light.png',
      fullPage: false,
    });
    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await page.screenshot({
      path: 'test-results/screenshots/result-ro-dark.png',
      fullPage: false,
    });
    await page.getByRole('button', { name: 'Toggle theme' }).click();

    // Create a league and check League page link -> /ro/regulament#ligi
    const lgRes = await request.post('/api/leagues', {
      data: { uid, tz: 'Europe/Bucharest', locale: 'ro', name: 'Liga Regulament' },
    });
    const lgData = await lgRes.json();
    await page.goto(`/ro/league/${encodeURIComponent(lgData.leagueId)}`);
    const leagueRulesLink = page.getByTestId('league-rules-link');
    await expect(leagueRulesLink).toBeVisible();
    await expect(leagueRulesLink).toHaveText('Regulament');
    await expect(leagueRulesLink).toHaveAttribute('href', '/ro/regulament#ligi');
    await page.screenshot({
      path: 'test-results/screenshots/league-ro-light.png',
      fullPage: false,
    });
    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await page.screenshot({
      path: 'test-results/screenshots/league-ro-dark.png',
      fullPage: false,
    });
    await page.getByRole('button', { name: 'Toggle theme' }).click();

    // Create a duel and check Duel page link -> /ro/regulament#dueluri
    const duelRes = await request.post('/api/duels', {
      data: { challengerUid: uid, nickname: 'Ștefan', tz: 'Europe/Bucharest' },
    });
    const duelData = await duelRes.json();
    await page.goto(`/ro/duel/${encodeURIComponent(duelData.duelId)}`);
    const duelRulesLink = page.getByTestId('duel-rules-link');
    await expect(duelRulesLink).toBeVisible();
    await expect(duelRulesLink).toHaveText('Regulile duelului');
    await expect(duelRulesLink).toHaveAttribute('href', '/ro/regulament#dueluri');
    await page.screenshot({
      path: 'test-results/screenshots/duel-ro-light.png',
      fullPage: false,
    });
    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await page.screenshot({
      path: 'test-results/screenshots/duel-ro-dark.png',
      fullPage: false,
    });
  });
});
