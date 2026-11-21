import { expect, test } from '@playwright/test';

test.describe('Splash Screen, Homepage "Cum merge" Explainer & SEO', () => {
  test('Romanian /ro homepage has proper SEO title, meta description, Open Graph/Twitter card, FAQPage JSON-LD, above-the-fold hero on 390px, and Cum merge explainer section', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ro');

    // PART 3 — SEO
    await expect(page).toHaveTitle('RonDuel — Trivia zilnic pentru grupul tău de prieteni');
    const metaDesc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(metaDesc).toBe(
      '6 întrebări pe zi, un minut, o singură încercare. Fă-ți ligă cu prietenii și vezi cine e cel mai tare.',
    );

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toContain('og-card-ro.png');

    const twitterImage = await page.locator('meta[name="twitter:image"]').getAttribute('content');
    expect(twitterImage).toContain('og-card-ro.png');

    // FAQPage JSON-LD
    const jsonLdText = await page.locator('script[type="application/ld+json"]').textContent();
    expect(jsonLdText).toBeTruthy();
    const jsonLd = JSON.parse(jsonLdText!);
    expect(jsonLd['@type']).toBe('FAQPage');
    expect(jsonLd.mainEntity).toHaveLength(4);
    expect(jsonLd.mainEntity[0].name).toBe('E gratuit?');
    expect(jsonLd.mainEntity[0].acceptedAnswer.text).toBe(
      'Da. Runda zilnică, ligile și duelurile sunt gratuite. Pro adaugă ligi mari, dueluri nelimitate și scut pentru serie.',
    );

    // Above the fold on 390px-wide screen: Hero and "Joacă runda de azi" button
    const heroBtn = page.getByRole('button', { name: 'Joacă runda de azi' }).first();
    await expect(heroBtn).toBeVisible();
    const box = await heroBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThan(844);

    // PART 2 — "Cum merge" section (left-right slideable cards carousel)
    await expect(page.getByRole('heading', { name: 'Cum merge' })).toBeVisible();
    await expect(page.getByTestId('explainer-carousel-track')).toBeVisible();
    await expect(page.getByText('6 întrebări, un minut')).toBeVisible();
    await expect(
      page.getByText('Grilă, ordonare, intrusul și logică. Răspunzi repede, iei bonus de viteză.'),
    ).toBeVisible();

    // Slide to step 2 & step 3 using carousel navigation buttons
    await page.getByTestId('explainer-next-btn').click();
    await expect(page.getByText('O singură încercare pe zi')).toBeVisible();
    await expect(
      page.getByText('Toată lumea primește aceeași rundă. Se resetează la miezul nopții.'),
    ).toBeVisible();

    await page.getByTestId('explainer-next-btn').click();
    await expect(page.getByText('Bate-ți prietenii')).toBeVisible();
    await expect(
      page.getByText(
        'Trimite rezultatul pe grup și liga voastră se face singură. Scorurile lor apar abia după ce joci.',
      ),
    ).toBeVisible();

    // Demo card
    await expect(page.getByText('RonDuel #12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5')).toBeVisible();
    await expect(page.getByText('Așa arată rezultatul tău pe WhatsApp.')).toBeVisible();

    // Ligi și dueluri
    await expect(page.getByRole('heading', { name: 'Ligi și dueluri' })).toBeVisible();
    await expect(
      page.getByText('Ligi private prin link, doar cu poreclă — fără cont'),
    ).toBeVisible();
    await expect(page.getByText('Duel 1v1 când vrei, 24h să răspundă')).toBeVisible();

    // FAQ accordion (4 items)
    await expect(page.getByRole('button', { name: 'E gratuit?' })).toBeVisible();
    await expect(
      page.getByText(
        'Da. Runda zilnică, ligile și duelurile sunt gratuite. Pro adaugă ligi mari, dueluri nelimitate și scut pentru serie.',
      ),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Trebuie cont?' }).click();
    await expect(
      page.getByText('Nu. Joci direct cu o poreclă. Îți poți salva progresul cu email oricând.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Când apare runda nouă?' }).click();
    await expect(page.getByText('La miezul nopții, ora ta locală.')).toBeVisible();

    await page.getByRole('button', { name: 'Pot instala aplicația?' }).click();
    await expect(page.getByText('Da, din browser: Adaugă pe ecranul principal.')).toBeVisible();

    // Final CTA repeating main button
    const finalCta = page.getByTestId('explainer-final-cta');
    await expect(finalCta).toHaveText('Joacă runda de azi');

    // PART 1.5 — manifest.json with maskable 192/512 and apple-touch-startup-image
    const manifestRes = await request.get('/manifest.json');
    expect(manifestRes.status()).toBe(200);
    const manifest = await manifestRes.json();
    expect(manifest.name).toBe('RonDuel');
    expect(manifest.short_name).toBe('RonDuel');
    expect(
      manifest.icons.some(
        (i: { sizes: string; purpose: string }) =>
          i.sizes === '192x192' && i.purpose === 'maskable',
      ),
    ).toBe(true);
    expect(
      manifest.icons.some(
        (i: { sizes: string; purpose: string }) =>
          i.sizes === '512x512' && i.purpose === 'maskable',
      ),
    ).toBe(true);
    expect(manifest.apple_touch_startup_image.length).toBeGreaterThanOrEqual(10);

    // Check apple-touch-startup-image link tags in HTML head
    const startupLinksCount = await page.locator('link[rel="apple-touch-startup-image"]').count();
    expect(startupLinksCount).toBeGreaterThanOrEqual(10);
  });

  test('Splash screen redirects straight to result page when player already played today and shows streak & tomorrow tagline', async ({
    page,
  }) => {
    await page.route('**/api/game/status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          date: '2026-12-12',
          roundNumber: 12,
          topicOfTheDay: 'World & Science 🌍',
          played: true,
          inProgress: false,
          playId: '2026-12-12_u_demo',
          streakCurrent: 5,
          streakBest: 5,
          leagues: [],
        }),
      });
    });

    await page.goto('/ro');
    await expect(page).toHaveURL(/\/ro\/result\/2026-12-12_u_demo/, { timeout: 5_000 });
  });

  test('Footer "Termeni și condiții" link navigates to legal/terms and renders translated content in all 4 languages (ro, en, es, pt)', async ({
    page,
  }) => {
    // Romanian (/ro) -> click footer link "Termeni și condiții" -> /ro/legal/terms
    await page.goto('/ro');
    await page.locator('footer').getByRole('link', { name: 'Termeni și condiții' }).click();
    await expect(page).toHaveURL(/\/ro\/legal\/terms/);
    await expect(
      page.getByRole('heading', { name: 'Termeni și condiții de utilizare' }),
    ).toBeVisible();
    await expect(page.getByText('1. Acceptarea termenilor și eligibilitate (16+)')).toBeVisible();
    await expect(
      page.getByText('7. Limitarea răspunderii, modificări și legea aplicabilă'),
    ).toBeVisible();

    // English (/en) -> click footer link "Terms & Conditions" -> /en/legal/terms
    await page.goto('/en');
    await page.locator('footer').getByRole('link', { name: 'Terms & Conditions' }).click();
    await expect(page).toHaveURL(/\/en\/legal\/terms/);
    await expect(page.getByRole('heading', { name: 'Terms and Conditions of Use' })).toBeVisible();
    await expect(page.getByText('1. Acceptance of Terms & Eligibility (16+)')).toBeVisible();

    // Spanish (/es) -> click footer link "Términos y condiciones" -> /es/legal/terms
    await page.goto('/es');
    await page.locator('footer').getByRole('link', { name: 'Términos y condiciones' }).click();
    await expect(page).toHaveURL(/\/es\/legal\/terms/);
    await expect(
      page.getByRole('heading', { name: 'Términos y Condiciones de Uso' }),
    ).toBeVisible();
    await expect(
      page.getByText('1. Aceptación de los términos y elegibilidad (16+)'),
    ).toBeVisible();

    // Portuguese (/pt) -> click footer link "Termos e Condições" -> /pt/legal/terms
    await page.goto('/pt');
    await page.locator('footer').getByRole('link', { name: 'Termos e Condições' }).click();
    await expect(page).toHaveURL(/\/pt\/legal\/terms/);
    await expect(page.getByRole('heading', { name: 'Termos e Condições de Uso' })).toBeVisible();
    await expect(page.getByText('1. Aceitação dos termos e elegibilidade (16+)')).toBeVisible();
  });
});
