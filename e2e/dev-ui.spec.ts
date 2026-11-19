import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('/dev/ui design system showcase', () => {
  test('renders components and passes axe accessibility checks in light and dark mode', async ({
    page,
  }) => {
    await page.goto('/dev/ui');

    await expect(page.getByRole('heading', { name: /Typography & Diacritics/i })).toBeVisible();
    await expect(page.getByText('ș ț ă â î Ș Ț Ă Â Î')).toBeVisible();

    // Light mode axe audit
    const lightResults = await new AxeBuilder({ page }).analyze();
    expect(lightResults.violations).toEqual([]);

    // Switch to dark mode and re-run axe audit
    await page.getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const darkResults = await new AxeBuilder({ page }).analyze();
    expect(darkResults.violations).toEqual([]);

    // Open and close Sheet dialog
    await page.getByRole('button', { name: 'Open Sheet' }).click();
    await expect(page.getByRole('dialog', { name: 'Pick your nickname' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog', { name: 'Pick your nickname' })).toBeHidden();
  });
});
