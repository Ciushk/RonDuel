import { STRIPE_PRICES } from '@ronduel/shared';

export { STRIPE_PRICES };

export function formatPrice(
  amount: number,
  currency: string = STRIPE_PRICES.currency,
  locale: string = 'ro',
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} €`;
  }
}

export function formatYearlyPrice(locale: string = 'ro'): string {
  return formatPrice(STRIPE_PRICES.yearly, STRIPE_PRICES.currency, locale);
}

export function formatMonthlyPrice(locale: string = 'ro'): string {
  return formatPrice(STRIPE_PRICES.monthly, STRIPE_PRICES.currency, locale);
}
