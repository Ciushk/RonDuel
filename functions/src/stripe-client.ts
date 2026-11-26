import Stripe from 'stripe';

const STRIPE_CHECKOUT_LOCALES = new Set([
  'ro',
  'en',
  'es',
  'pt',
  'fr',
  'de',
  'it',
  'nl',
  'pl',
] as const);

export type StripeCheckoutLocale =
  'auto' | 'ro' | 'en' | 'es' | 'pt' | 'fr' | 'de' | 'it' | 'nl' | 'pl';

let cachedStripe: Stripe | null = null;
let cachedKey: string | null = null;

export function isFunctionsEmulator(): boolean {
  return process.env.FUNCTIONS_EMULATOR === 'true';
}

/**
 * Snapshot evaluated at module load; use `isFunctionsEmulator()` for dynamic env checks.
 */
export const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

/**
 * Returns a cached Stripe SDK client built from `process.env.STRIPE_SECRET_KEY`.
 * If no key is configured:
 * - In the Firebase Functions emulator (`FUNCTIONS_EMULATOR === 'true'`), returns `null`.
 * - In production, throws `Error('STRIPE_NOT_CONFIGURED')`.
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    if (isFunctionsEmulator()) {
      return null;
    }
    throw new Error('STRIPE_NOT_CONFIGURED');
  }

  if (cachedStripe && cachedKey === key) {
    return cachedStripe;
  }

  cachedStripe = new Stripe(key);
  cachedKey = key;
  return cachedStripe;
}

/**
 * Verifies a Stripe webhook signature against the raw request body using
 * `process.env.STRIPE_WEBHOOK_SECRET`. Never bypasses verification in the emulator.
 */
export function verifyStripeEvent(
  rawBody: Buffer | undefined,
  signature: string | undefined,
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!rawBody || !Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    throw new Error('Missing raw webhook body');
  }
  if (!signature || !signature.trim()) {
    throw new Error('Missing stripe-signature header');
  }
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  const client = process.env.STRIPE_SECRET_KEY?.trim() ? getStripe() : null;
  const webhooks = client ? client.webhooks : Stripe.webhooks;
  return webhooks.constructEvent(rawBody, signature, secret);
}

/**
 * Maps a UI locale to Stripe Checkout's supported locale subset, defaulting to `'auto'`.
 */
export function mapToStripeCheckoutLocale(locale: unknown): StripeCheckoutLocale {
  if (typeof locale === 'string') {
    const normalized = locale.trim().toLowerCase();
    if (STRIPE_CHECKOUT_LOCALES.has(normalized as Exclude<StripeCheckoutLocale, 'auto'>)) {
      return normalized as StripeCheckoutLocale;
    }
  }
  return 'auto';
}
