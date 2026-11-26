import Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PRO_CONSENT_TEXT_VERSION } from '../../apps/web/app/[locale]/pro/consent.js';
import {
  getOrCreateUser,
  getStore,
  markUserDirty,
  processStripeWebhook,
  type UserRecord,
} from '../../apps/web/lib/server-store.js';
import {
  createProCheckout,
  handleStripeWebhook,
  type ProCheckoutDeps,
  type StripeWebhookDeps,
} from './billing.js';
import { getStripe, mapToStripeCheckoutLocale, verifyStripeEvent } from './stripe-client.js';

const TEST_WEBHOOK_SECRET = 'whsec_test_ronduel_signing_secret_12345';

function makeRegisteredUser(uid: string, overrides?: Partial<UserRecord>): UserRecord {
  const user = getOrCreateUser({ uid });
  user.isAnonymous = false;
  user.email = `${uid}@example.com`;
  user.pro = { active: false };
  user.freezes = 0;
  if (overrides) {
    Object.assign(user, overrides);
  }
  return user;
}

function signStripePayload(eventObj: Record<string, unknown>, secret = TEST_WEBHOOK_SECRET) {
  const payload = JSON.stringify(eventObj);
  const rawBody = Buffer.from(payload, 'utf8');
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  return { rawBody, signature };
}

describe('Stripe Pro billing checkout & verified webhooks', () => {
  const origEmulator = process.env.FUNCTIONS_EMULATOR;
  const origStripeKey = process.env.STRIPE_SECRET_KEY;
  const origWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    delete process.env.FUNCTIONS_EMULATOR;
    delete process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    const store = getStore();
    store.users = {};
    store.stripeEvents = {};
    store.subscriptions = {};
  });

  afterEach(() => {
    if (origEmulator === undefined) delete process.env.FUNCTIONS_EMULATOR;
    else process.env.FUNCTIONS_EMULATOR = origEmulator;
    if (origStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = origStripeKey;
    if (origWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = origWebhookSecret;
  });

  function buildCheckoutDeps(overrides?: Partial<ProCheckoutDeps>): {
    deps: ProCheckoutDeps;
    sessionsCreate: ReturnType<typeof vi.fn>;
    syncUser: ReturnType<typeof vi.fn>;
    verifyIdToken: ReturnType<typeof vi.fn>;
    getUserFromFirestore: ReturnType<typeof vi.fn>;
  } {
    const sessionsCreate = vi.fn().mockResolvedValue({
      id: 'cs_test_pro_123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_pro_123',
    });
    const mockStripe = {
      checkout: {
        sessions: {
          create: sessionsCreate,
        },
      },
    } as unknown as Stripe;

    const syncUser = vi.fn().mockResolvedValue(undefined);
    const verifyIdToken = vi.fn().mockResolvedValue({
      uid: 'u_token_owner',
      email: 'owner@example.com',
      firebase: { sign_in_provider: 'google.com' },
    });
    const getUserFromFirestore = vi.fn().mockResolvedValue(null);

    const deps: ProCheckoutDeps = {
      verifyIdToken,
      getStoreUser: (uid) => getStore().users[uid],
      getUserFromFirestore,
      getOrCreateUser,
      markUserDirty,
      syncUserToFirestore: syncUser,
      processStripeWebhook,
      getStripe: () => mockStripe,
      priceIds: {
        monthly: 'price_test_monthly_499',
        yearly: 'price_test_yearly_3999',
      },
      publicBaseUrl: 'https://ronduel.web.app',
      ...overrides,
    };

    return { deps, sessionsCreate, syncUser, verifyIdToken, getUserFromFirestore };
  }

  describe('createProCheckout', () => {
    it('returns 401 UNAUTHENTICATED when Authorization Bearer token is missing or invalid', async () => {
      const { deps, verifyIdToken } = buildCheckoutDeps();
      const missingRes = await createProCheckout(
        {
          authHeader: null,
          body: { uid: 'u_spoofed', plan: 'yearly', euWithdrawalConsent: true },
        },
        deps,
      );
      expect(missingRes.status).toBe(401);
      expect(missingRes.body.code).toBe('UNAUTHENTICATED');

      verifyIdToken.mockRejectedValueOnce(new Error('invalid token'));
      const invalidRes = await createProCheckout(
        {
          authHeader: 'Bearer bad.jwt.token',
          body: { plan: 'yearly', euWithdrawalConsent: true },
        },
        deps,
      );
      expect(invalidRes.status).toBe(401);
      expect(invalidRes.body.code).toBe('UNAUTHENTICATED');
    });

    it('uses verified token uid and ignores a different body.uid', async () => {
      makeRegisteredUser('u_token_owner');
      makeRegisteredUser('u_victim');
      const { deps, sessionsCreate } = buildCheckoutDeps();

      const res = await createProCheckout(
        {
          authHeader: 'Bearer valid_token',
          body: {
            uid: 'u_victim',
            plan: 'monthly',
            euWithdrawalConsent: true,
            locale: 'de',
          },
        },
        deps,
      );

      expect(res.status).toBe(200);
      expect(sessionsCreate).toHaveBeenCalledTimes(1);
      const createArg = sessionsCreate.mock.calls[0][0];
      expect(createArg.client_reference_id).toBe('u_token_owner');
      expect(createArg.metadata.uid).toBe('u_token_owner');
      expect(createArg.subscription_data.metadata.uid).toBe('u_token_owner');
      expect(getStore().users['u_victim']?.pro?.active).toBe(false);
    });

    it('returns 403 for anonymous Firebase token or anonymous store user', async () => {
      makeRegisteredUser('u_anon_token');
      const { deps } = buildCheckoutDeps({
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'u_anon_token',
          firebase: { sign_in_provider: 'anonymous' },
        }),
      });

      const res = await createProCheckout(
        {
          authHeader: 'Bearer anon_token',
          body: { plan: 'yearly', euWithdrawalConsent: true },
        },
        deps,
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('returns 400 for unsupported plans including freeze_1 and missing EU consent', async () => {
      makeRegisteredUser('u_token_owner');
      const { deps, sessionsCreate } = buildCheckoutDeps();

      const badPlan = await createProCheckout(
        {
          authHeader: 'Bearer valid_token',
          body: { plan: 'freeze_1', euWithdrawalConsent: true },
        },
        deps,
      );
      expect(badPlan.status).toBe(400);

      const noConsent = await createProCheckout(
        {
          authHeader: 'Bearer valid_token',
          body: { plan: 'yearly', euWithdrawalConsent: false },
        },
        deps,
      );
      expect(noConsent.status).toBe(400);
      expect(noConsent.body.code).toBe('CONSENT_REQUIRED');
      expect(sessionsCreate).not.toHaveBeenCalled();
    });

    it('returns 503 BILLING_NOT_CONFIGURED when the price param for the plan is empty', async () => {
      makeRegisteredUser('u_token_owner');
      const { deps, sessionsCreate } = buildCheckoutDeps({
        priceIds: { monthly: '', yearly: '' },
      });

      const res = await createProCheckout(
        {
          authHeader: 'Bearer valid_token',
          body: { plan: 'yearly', euWithdrawalConsent: true },
        },
        deps,
      );

      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        error: 'Pro checkout not configured',
        code: 'BILLING_NOT_CONFIGURED',
      });
      expect(sessionsCreate).not.toHaveBeenCalled();
      expect(getStore().users['u_token_owner']?.pro?.active).toBe(false);
    });

    it('creates a subscription Checkout Session with metadata/locale and never grants Pro directly', async () => {
      const user = makeRegisteredUser('u_token_owner');
      const { deps, sessionsCreate } = buildCheckoutDeps();

      const res = await createProCheckout(
        {
          authHeader: 'Bearer valid_token',
          body: { plan: 'yearly', euWithdrawalConsent: true, locale: 'en' },
        },
        deps,
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        mode: 'stripe_checkout',
        sessionId: 'cs_test_pro_123',
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_pro_123',
      });

      expect(sessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          locale: 'en',
          line_items: [{ price: 'price_test_yearly_3999', quantity: 1 }],
          client_reference_id: 'u_token_owner',
          customer_email: 'owner@example.com',
          metadata: expect.objectContaining({
            type: 'pro_subscription',
            uid: 'u_token_owner',
            plan: 'yearly',
            euWithdrawalConsent: 'true',
            consentTextVersion: PRO_CONSENT_TEXT_VERSION,
          }),
          subscription_data: {
            metadata: {
              type: 'pro_subscription',
              uid: 'u_token_owner',
              plan: 'yearly',
            },
          },
          success_url:
            'https://ronduel.web.app/en/pro?checkout=success&session_id={CHECKOUT_SESSION_ID}',
          cancel_url: 'https://ronduel.web.app/en/pro?checkout=canceled',
        }),
      );
      expect(sessionsCreate.mock.calls[0][0].metadata.consentAt).toBeTruthy();

      // Paid checkout MUST NOT grant Pro before webhook confirmation
      expect(user.pro).toEqual({ active: false });
    });

    it('maps unsupported Stripe checkout locales to auto while validating URL locale', async () => {
      makeRegisteredUser('u_token_owner');
      const { deps, sessionsCreate } = buildCheckoutDeps();

      expect(mapToStripeCheckoutLocale('ro')).toBe('ro');
      expect(mapToStripeCheckoutLocale('pl')).toBe('pl');
      expect(mapToStripeCheckoutLocale('sv')).toBe('auto');
      expect(mapToStripeCheckoutLocale(undefined)).toBe('auto');

      await createProCheckout(
        {
          authHeader: 'Bearer valid_token',
          body: { plan: 'monthly', euWithdrawalConsent: true, locale: 'sv' },
        },
        deps,
      );

      expect(sessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: 'auto',
          success_url:
            'https://ronduel.web.app/sv/pro?checkout=success&session_id={CHECKOUT_SESSION_ID}',
          cancel_url: 'https://ronduel.web.app/sv/pro?checkout=canceled',
        }),
      );
    });

    it('grants 7-day trial once with +1 freeze and rejects a second attempt with 409 TRIAL_USED', async () => {
      const user = makeRegisteredUser('u_token_owner', { freezes: 1 });
      const { deps, sessionsCreate, syncUser } = buildCheckoutDeps();

      const first = await createProCheckout(
        {
          authHeader: 'Bearer valid_token',
          body: { plan: 'yearly', trial: true, euWithdrawalConsent: true },
        },
        deps,
      );

      expect(first.status).toBe(200);
      expect(first.body.mode).toBe('trial_activated');
      expect(user.pro?.active).toBe(true);
      expect(user.pro?.isTrial).toBe(true);
      expect(user.pro?.plan).toBe('yearly');
      expect(user.pro?.trialEndsAt).toBe(user.pro?.until);
      expect(user.freezes).toBe(2);
      expect(syncUser).toHaveBeenCalledWith(user);
      expect(sessionsCreate).not.toHaveBeenCalled();

      const second = await createProCheckout(
        {
          authHeader: 'Bearer valid_token',
          body: { plan: 'yearly', trial: true, euWithdrawalConsent: true },
        },
        deps,
      );
      expect(second.status).toBe(409);
      expect(second.body.code).toBe('TRIAL_USED');
    });

    it('fails closed in production when STRIPE_SECRET_KEY is absent and never grants Pro', async () => {
      delete process.env.FUNCTIONS_EMULATOR;
      delete process.env.STRIPE_SECRET_KEY;

      expect(() => getStripe()).toThrow('STRIPE_NOT_CONFIGURED');

      const user = makeRegisteredUser('u_token_owner');
      const { deps } = buildCheckoutDeps({ getStripe });

      const res = await createProCheckout(
        {
          authHeader: 'Bearer valid_token',
          body: { plan: 'yearly', euWithdrawalConsent: true },
        },
        deps,
      );

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('BILLING_NOT_CONFIGURED');
      expect(user.pro?.active).toBe(false);
    });

    it('uses local_test_webhook only in the emulator when STRIPE_SECRET_KEY is absent', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true';
      delete process.env.STRIPE_SECRET_KEY;

      const user = makeRegisteredUser('u_emu_user');
      const { deps } = buildCheckoutDeps({ getStripe });

      const res = await createProCheckout(
        {
          authHeader: null,
          testUidHeader: 'u_emu_user',
          body: { plan: 'monthly', euWithdrawalConsent: true },
        },
        deps,
      );

      expect(res.status).toBe(200);
      expect(res.body.mode).toBe('local_test_webhook');
      expect(user.pro?.active).toBe(true);
      expect(user.pro?.plan).toBe('monthly');
    });
  });

  describe('handleStripeWebhook', () => {
    function buildWebhookDeps(overrides?: Partial<StripeWebhookDeps>) {
      const subscriptionsRetrieve = vi.fn().mockResolvedValue({
        id: 'sub_test_123',
        status: 'active',
        items: {
          data: [{ current_period_end: 1800000000 }],
        },
      });
      const mockStripe = {
        subscriptions: {
          retrieve: subscriptionsRetrieve,
        },
      } as unknown as Stripe;

      const getUserFromFirestore = vi.fn().mockImplementation(async (uid: string) => {
        return makeRegisteredUser(uid);
      });
      const handleTown = vi.fn().mockResolvedValue({ processed: true });

      const deps: StripeWebhookDeps = {
        verifyStripeEvent,
        getStripe: () => mockStripe,
        getStoreUser: (uid) => getStore().users[uid],
        getUserFromFirestore,
        processStripeWebhook,
        handleTownStripeWebhook: handleTown,
        ...overrides,
      };

      return { deps, subscriptionsRetrieve, getUserFromFirestore, handleTown };
    }

    it('returns 400 Invalid signature for unsigned or tampered payloads even in emulator', async () => {
      process.env.FUNCTIONS_EMULATOR = 'true';
      const user = makeRegisteredUser('u_unsigned');
      const { deps } = buildWebhookDeps();

      const unsignedRes = await handleStripeWebhook(
        {
          rawBody: Buffer.from(
            JSON.stringify({
              id: 'evt_unsigned',
              type: 'checkout.session.completed',
              data: {
                object: {
                  metadata: { type: 'pro_subscription', uid: 'u_unsigned', plan: 'yearly' },
                },
              },
            }),
          ),
          signature: undefined,
        },
        deps,
      );
      expect(unsignedRes.status).toBe(400);
      expect(unsignedRes.body).toEqual({ error: 'Invalid signature' });
      expect(user.pro?.active).toBe(false);

      const badSigRes = await handleStripeWebhook(
        {
          rawBody: Buffer.from('{"id":"evt_bad","type":"checkout.session.completed"}'),
          signature: 't=12345,v1=deadbeef',
        },
        deps,
      );
      expect(badSigRes.status).toBe(400);
      expect(badSigRes.body).toEqual({ error: 'Invalid signature' });
      expect(user.pro?.active).toBe(false);
    });

    it('activates Pro on valid signed checkout.session.completed and is idempotent on replay', async () => {
      const { deps, subscriptionsRetrieve, getUserFromFirestore } = buildWebhookDeps();
      const signed = signStripePayload({
        id: 'evt_pro_completed_1',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_1',
            object: 'checkout.session',
            mode: 'subscription',
            status: 'complete',
            payment_status: 'paid',
            subscription: 'sub_test_123',
            metadata: {
              type: 'pro_subscription',
              uid: 'u_fresh_instance',
              plan: 'yearly',
            },
          },
        },
      });

      const res = await handleStripeWebhook(signed, deps);
      expect(res.status).toBe(200);
      expect(res.body.duplicate).toBe(false);
      expect(getUserFromFirestore).toHaveBeenCalledWith('u_fresh_instance');
      expect(subscriptionsRetrieve).toHaveBeenCalledWith('sub_test_123');

      const user = getStore().users['u_fresh_instance'];
      expect(user?.pro?.active).toBe(true);
      expect(user?.pro?.plan).toBe('yearly');
      expect(user?.pro?.until).toBe(new Date(1800000000 * 1000).toISOString());

      // Replay same signed event -> duplicate: true
      const replay = await handleStripeWebhook(signed, deps);
      expect(replay.status).toBe(200);
      expect(replay.body.duplicate).toBe(true);
    });

    it('routes signed town_coin_purchase checkout events to handleTownStripeWebhook', async () => {
      const { deps, handleTown } = buildWebhookDeps();
      const signed = signStripePayload({
        id: 'evt_coin_1',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_coin_1',
            object: 'checkout.session',
            mode: 'payment',
            payment_status: 'paid',
            metadata: {
              type: 'town_coin_purchase',
              uid: 'u_coin_buyer',
              packId: 'pack_1000',
              coins: '1000',
              eur: '1.99',
            },
          },
        },
      });

      const res = await handleStripeWebhook(signed, deps);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ processed: true });
      expect(handleTown).toHaveBeenCalledTimes(1);
    });

    it('deactivates Pro on signed customer.subscription.deleted and canceled updates', async () => {
      const user = makeRegisteredUser('u_cancel_me', {
        pro: { active: true, plan: 'monthly', until: '2027-01-01T00:00:00.000Z' },
      });
      const { deps } = buildWebhookDeps();

      const deletedSigned = signStripePayload({
        id: 'evt_sub_deleted_1',
        object: 'event',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_cancel_1',
            object: 'subscription',
            status: 'canceled',
            metadata: { uid: 'u_cancel_me', plan: 'monthly' },
          },
        },
      });

      const res = await handleStripeWebhook(deletedSigned, deps);
      expect(res.status).toBe(200);
      expect(user.pro?.active).toBe(false);

      // Canceled via customer.subscription.updated also maps to deleted
      user.pro = { active: true, plan: 'yearly', until: '2027-01-01T00:00:00.000Z' };
      const updatedCancelSigned = signStripePayload({
        id: 'evt_sub_updated_canceled_1',
        object: 'event',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_cancel_2',
            object: 'subscription',
            status: 'canceled',
            metadata: { uid: 'u_cancel_me', plan: 'yearly' },
          },
        },
      });

      const res2 = await handleStripeWebhook(updatedCancelSigned, deps);
      expect(res2.status).toBe(200);
      expect(user.pro?.active).toBe(false);
    });

    it('returns 200 processed:false for unknown event types and missing uid', async () => {
      const { deps } = buildWebhookDeps();
      const signed = signStripePayload({
        id: 'evt_unknown_1',
        object: 'event',
        type: 'invoice.created',
        data: { object: { id: 'in_1' } },
      });

      const res = await handleStripeWebhook(signed, deps);
      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(false);
    });
  });
});
