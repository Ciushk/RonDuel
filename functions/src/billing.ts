import { LOCALES } from '@ronduel/shared';
import type Stripe from 'stripe';

import { PRO_CONSENT_TEXT_VERSION } from '../../apps/web/app/[locale]/pro/consent.js';
import { extractBearerToken } from '../../apps/web/lib/ronbot-auth.js';
import type { processStripeWebhook, UserRecord } from '../../apps/web/lib/server-store.js';
import { isFunctionsEmulator, mapToStripeCheckoutLocale } from './stripe-client.js';

export type ProPlan = 'monthly' | 'yearly';

export interface DecodedIdTokenLike {
  uid: string;
  email?: string;
  firebase?: {
    sign_in_provider?: string;
  };
}

export interface BillingHttpResult {
  status: number;
  body: Record<string, unknown>;
}

export interface ProCheckoutInput {
  authHeader?: string | null;
  testUidHeader?: string | null;
  body: Record<string, unknown>;
}

export interface ProCheckoutDeps {
  verifyIdToken: (token: string) => Promise<DecodedIdTokenLike>;
  getStoreUser: (uid: string) => UserRecord | undefined;
  getUserFromFirestore: (uid: string) => Promise<UserRecord | null>;
  getOrCreateUser: (params: { uid: string }) => UserRecord;
  markUserDirty: (uid: string) => void;
  syncUserToFirestore: (user: UserRecord) => Promise<void>;
  processStripeWebhook: typeof processStripeWebhook;
  getStripe: () => Stripe | null;
  priceIds: {
    monthly: string;
    yearly: string;
  };
  publicBaseUrl: string;
  isEmulator?: boolean;
}

export interface StripeWebhookInput {
  rawBody: Buffer | undefined;
  signature: string | undefined;
}

export interface StripeWebhookDeps {
  verifyStripeEvent: (rawBody: Buffer | undefined, signature: string | undefined) => Stripe.Event;
  getStripe: () => Stripe | null;
  getStoreUser: (uid: string) => UserRecord | undefined;
  getUserFromFirestore: (uid: string) => Promise<UserRecord | null>;
  processStripeWebhook: typeof processStripeWebhook;
  handleTownStripeWebhook: (
    event: Stripe.Event,
  ) => Promise<{ processed: boolean; reason?: string }>;
}

function extractSubscriptionPeriodEndIso(sub: Stripe.Subscription): string | undefined {
  const itemEnd = sub.items?.data?.[0]?.current_period_end;
  const legacyEnd = (sub as unknown as { current_period_end?: unknown }).current_period_end;
  const epochSec =
    typeof itemEnd === 'number' && Number.isFinite(itemEnd)
      ? itemEnd
      : typeof legacyEnd === 'number' && Number.isFinite(legacyEnd)
        ? legacyEnd
        : undefined;
  return epochSec ? new Date(epochSec * 1000).toISOString() : undefined;
}

function resolveUrlLocale(raw: unknown): string {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if ((LOCALES as readonly string[]).includes(trimmed)) {
      return trimmed;
    }
  }
  return 'ro';
}

/**
 * Handles `POST /billing/checkout` for RonDuel Pro subscriptions and one-time 7-day trials.
 * Never grants paid Pro entitlements directly; paid plans create a real Stripe Checkout Session
 * and entitlements are granted exclusively from verified Stripe webhooks.
 */
export async function createProCheckout(
  input: ProCheckoutInput,
  deps: ProCheckoutDeps,
): Promise<BillingHttpResult> {
  const emulator = deps.isEmulator ?? isFunctionsEmulator();

  // 1. Identity: require cryptographic Firebase ID token (ignore body.uid).
  let decoded: DecodedIdTokenLike | null = null;
  const bearerToken = extractBearerToken(input.authHeader);
  if (bearerToken) {
    try {
      const verified = await deps.verifyIdToken(bearerToken);
      if (verified?.uid) {
        decoded = verified;
      }
    } catch {
      decoded = null;
    }
  }

  // Emulator-only test bypass, mirroring authorizeRonBotChat
  if (!decoded && emulator) {
    const testUid = input.testUidHeader?.trim();
    if (testUid) {
      decoded = { uid: testUid };
    }
  }

  if (!decoded?.uid) {
    return {
      status: 401,
      body: {
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
      },
    };
  }

  const uid = decoded.uid;
  if (!deps.getStoreUser(uid)) {
    await deps.getUserFromFirestore(uid);
  }
  const user = deps.getOrCreateUser({ uid });

  if (decoded.firebase?.sign_in_provider === 'anonymous' || user.isAnonymous) {
    return {
      status: 403,
      body: {
        error: 'Please upgrade your anonymous account before purchasing RonDuel Pro.',
        code: 'FORBIDDEN',
      },
    };
  }

  // 2. Plan & EU immediate digital access consent
  const rawPlan = input.body.plan;
  if (rawPlan !== 'monthly' && rawPlan !== 'yearly') {
    return {
      status: 400,
      body: {
        error: 'Invalid plan. Only monthly and yearly Pro plans are supported.',
        code: 'INVALID_PLAN',
      },
    };
  }
  const plan: ProPlan = rawPlan;

  if (input.body.euWithdrawalConsent !== true) {
    return {
      status: 400,
      body: {
        error: 'EU immediate digital content access consent is required before checkout.',
        code: 'CONSENT_REQUIRED',
      },
    };
  }

  // 3. One-time 7-day trial (no Stripe)
  if (input.body.trial === true) {
    if (user.pro?.active || user.pro?.isTrial || user.pro?.until) {
      return {
        status: 409,
        body: {
          error: 'Pro trial has already been used.',
          code: 'TRIAL_USED',
        },
      };
    }

    const trialDays = 7;
    const trialEndsAt = new Date(Date.now() + trialDays * 86_400_000).toISOString();
    user.pro = {
      active: true,
      plan,
      until: trialEndsAt,
      isTrial: true,
      trialEndsAt,
    };
    user.freezes = Math.min(5, (user.freezes ?? 0) + 1);
    deps.markUserDirty(user.uid);
    await deps.syncUserToFirestore(user);

    return {
      status: 200,
      body: {
        mode: 'trial_activated',
        pro: user.pro,
        freezes: user.freezes,
      },
    };
  }

  // 4. Paid Pro checkout
  if (user.pro?.active && !user.pro?.isTrial) {
    return {
      status: 409,
      body: {
        error: 'RonDuel Pro is already active on this account.',
        code: 'ALREADY_PRO',
      },
    };
  }

  let stripe: Stripe | null;
  try {
    stripe = deps.getStripe();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'STRIPE_NOT_CONFIGURED';
    if (message === 'STRIPE_NOT_CONFIGURED') {
      return {
        status: 503,
        body: {
          error: 'Pro checkout not configured',
          code: 'BILLING_NOT_CONFIGURED',
        },
      };
    }
    throw err;
  }

  // 5. Emulator-only local simulation when STRIPE_SECRET_KEY is absent
  if (!stripe) {
    if (!emulator) {
      return {
        status: 503,
        body: {
          error: 'Pro checkout not configured',
          code: 'BILLING_NOT_CONFIGURED',
        },
      };
    }

    const eventId = `evt_local_${Date.now()}_${uid}`;
    const wh = deps.processStripeWebhook({
      eventId,
      type: 'checkout.session.completed',
      uid,
      plan,
    });
    return {
      status: 200,
      body: {
        mode: 'local_test_webhook',
        eventId,
        pro: wh.pro,
        freezes: wh.freezes,
      },
    };
  }

  const priceId = (plan === 'yearly' ? deps.priceIds.yearly : deps.priceIds.monthly).trim();
  if (!priceId) {
    return {
      status: 503,
      body: {
        error: 'Pro checkout not configured',
        code: 'BILLING_NOT_CONFIGURED',
      },
    };
  }

  const urlLocale = resolveUrlLocale(input.body.locale);
  const stripeLocale = mapToStripeCheckoutLocale(input.body.locale);
  const baseUrl = deps.publicBaseUrl.replace(/\/+$/, '');

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    locale: stripeLocale,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: uid,
    ...(decoded.email ? { customer_email: decoded.email } : {}),
    metadata: {
      type: 'pro_subscription',
      uid,
      plan,
      euWithdrawalConsent: 'true',
      consentAt: new Date().toISOString(),
      consentTextVersion: PRO_CONSENT_TEXT_VERSION,
    },
    subscription_data: {
      metadata: {
        type: 'pro_subscription',
        uid,
        plan,
      },
    },
    success_url: `${baseUrl}/${urlLocale}/pro?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/${urlLocale}/pro?checkout=canceled`,
  });

  return {
    status: 200,
    body: {
      mode: 'stripe_checkout',
      sessionId: session.id,
      checkoutUrl: session.url,
    },
  };
}

/**
 * Verifies the Stripe webhook signature from `rawBody` and dispatches both Pro subscription
 * events and RonTown coin purchase events. Never reads `req.body`.
 */
export async function handleStripeWebhook(
  input: StripeWebhookInput,
  deps: StripeWebhookDeps,
): Promise<BillingHttpResult> {
  let event: Stripe.Event;
  try {
    event = deps.verifyStripeEvent(input.rawBody, input.signature);
  } catch {
    return {
      status: 400,
      body: { error: 'Invalid signature' },
    };
  }

  const ensureUserLoaded = async (uid: string) => {
    if (!deps.getStoreUser(uid)) {
      await deps.getUserFromFirestore(uid);
    }
  };

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata ?? {};

    if (metadata.type === 'town_coin_purchase') {
      const result = await deps.handleTownStripeWebhook(event);
      return { status: 200, body: result };
    }

    if (metadata.type === 'pro_subscription') {
      const isPaidOrComplete =
        session.payment_status === 'paid' ||
        (session.mode === 'subscription' && session.status === 'complete');

      if (!isPaidOrComplete) {
        return {
          status: 200,
          body: { processed: false, reason: 'Checkout session not paid or complete' },
        };
      }

      const uid = typeof metadata.uid === 'string' ? metadata.uid.trim() : '';
      if (!uid) {
        return {
          status: 200,
          body: { processed: false, reason: 'Missing uid in session metadata' },
        };
      }

      const plan: ProPlan = metadata.plan === 'yearly' ? 'yearly' : 'monthly';
      let currentPeriodEnd: string | undefined;

      if (session.subscription) {
        if (typeof session.subscription === 'string') {
          try {
            const stripe = deps.getStripe();
            if (stripe) {
              const sub = await stripe.subscriptions.retrieve(session.subscription);
              currentPeriodEnd = extractSubscriptionPeriodEndIso(sub);
            }
          } catch {
            // Fall back to default period end in processStripeWebhook if retrieval fails
          }
        } else {
          currentPeriodEnd = extractSubscriptionPeriodEndIso(session.subscription);
        }
      }

      await ensureUserLoaded(uid);
      const result = deps.processStripeWebhook({
        eventId: event.id,
        type: 'checkout.session.completed',
        uid,
        plan,
        currentPeriodEnd,
      });
      return { status: 200, body: result as Record<string, unknown> };
    }

    return {
      status: 200,
      body: { processed: false, reason: 'Unhandled checkout session metadata type' },
    };
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const metadata = subscription.metadata ?? {};
    const uid = typeof metadata.uid === 'string' ? metadata.uid.trim() : '';
    if (!uid) {
      return {
        status: 200,
        body: { processed: false, reason: 'Missing uid in subscription metadata' },
      };
    }

    const plan: ProPlan = metadata.plan === 'yearly' ? 'yearly' : 'monthly';
    const status = subscription.status;

    if (status === 'active' || status === 'trialing') {
      const currentPeriodEnd = extractSubscriptionPeriodEndIso(subscription);
      await ensureUserLoaded(uid);
      const result = deps.processStripeWebhook({
        eventId: event.id,
        type: 'customer.subscription.updated',
        uid,
        plan,
        currentPeriodEnd,
      });
      return { status: 200, body: result as Record<string, unknown> };
    }

    if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
      await ensureUserLoaded(uid);
      const result = deps.processStripeWebhook({
        eventId: event.id,
        type: 'customer.subscription.deleted',
        uid,
        plan,
      });
      return { status: 200, body: result as Record<string, unknown> };
    }

    return {
      status: 200,
      body: { processed: false, reason: `Ignored subscription status: ${status}` },
    };
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const metadata = subscription.metadata ?? {};
    const uid = typeof metadata.uid === 'string' ? metadata.uid.trim() : '';
    if (!uid) {
      return {
        status: 200,
        body: { processed: false, reason: 'Missing uid in subscription metadata' },
      };
    }

    const plan: ProPlan = metadata.plan === 'yearly' ? 'yearly' : 'monthly';
    await ensureUserLoaded(uid);
    const result = deps.processStripeWebhook({
      eventId: event.id,
      type: 'customer.subscription.deleted',
      uid,
      plan,
    });
    return { status: 200, body: result as Record<string, unknown> };
  }

  return {
    status: 200,
    body: { processed: false, reason: `Ignored event type: ${event.type}` },
  };
}
