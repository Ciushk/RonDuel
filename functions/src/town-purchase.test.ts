import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as stripeClient from './stripe-client.js';
import { clearEconomyConfigCache } from './town-economy.js';
import {
  createCoinCheckoutSession,
  handleTownStripeWebhook,
  processSuccessfulCoinPurchase,
} from './town-purchase.js';

describe('town-purchase business logic & dedicated webhook', () => {
  let store: Map<string, Record<string, unknown>>;
  let mockDb: any;
  const origEmulator = process.env.FUNCTIONS_EMULATOR;
  const origStripeKey = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    delete process.env.STRIPE_SECRET_KEY;
    clearEconomyConfigCache();
    store = new Map();

    store.set('config/townEconomy', {
      enabled: true,
      purchasesEnabled: true,
      transfersEnabled: false,
      helpEnabled: false,
      purchase: {
        monthlyCapEUR: 20,
        packs: [
          { id: 'pack_1000', coins: 1000, eur: 1.99 },
          { id: 'pack_2800', coins: 2800, eur: 4.99 },
          { id: 'pack_6000', coins: 6000, eur: 9.99 },
          { id: 'pack_13000', coins: 13000, eur: 19.99 },
        ],
        referenceEurPerCoin: 0.00199,
      },
    });

    mockDb = {
      collection: (col: string) => ({
        doc: (id: string) => {
          const docPath = `${col}/${id}`;
          return {
            path: docPath,
            get: async () => {
              const data = store.get(docPath);
              return { exists: data !== undefined, data: () => data };
            },
            set: async (val: any, opts?: any) => {
              if (opts?.merge) {
                const prev = store.get(docPath) || {};
                store.set(docPath, { ...prev, ...val });
              } else {
                store.set(docPath, val);
              }
            },
            collection: (subCol: string) => {
              const subPrefix = `${docPath}/${subCol}`;
              return {
                doc: (subId: string) => {
                  const subDocPath = `${subPrefix}/${subId}`;
                  return {
                    path: subDocPath,
                    get: async () => {
                      const data = store.get(subDocPath);
                      return { exists: data !== undefined, data: () => data };
                    },
                    set: async (val: any, opts?: any) => {
                      if (opts?.merge) {
                        const prev = store.get(subDocPath) || {};
                        store.set(subDocPath, { ...prev, ...val });
                      } else {
                        store.set(subDocPath, val);
                      }
                    },
                  };
                },
              };
            },
          };
        },
      }),
      runTransaction: async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          get: async (ref: any) => {
            const data = store.get(ref.path);
            return { exists: data !== undefined, data: () => data };
          },
          set: (ref: any, val: any, opts?: any) => {
            if (opts?.merge) {
              const prev = store.get(ref.path) || {};
              store.set(ref.path, { ...prev, ...val });
            } else {
              store.set(ref.path, val);
            }
          },
          update: (ref: any, val: any) => {
            const prev = store.get(ref.path) || {};
            const next = { ...prev };
            for (const [k, v] of Object.entries(val)) {
              next[k] = v;
            }
            store.set(ref.path, next);
          },
        };
        return fn(tx);
      },
    };
  });

  it('rejects checkout when purchasesEnabled is false', async () => {
    store.set('config/townEconomy', {
      enabled: true,
      purchasesEnabled: false,
    });

    await expect(
      createCoinCheckoutSession(mockDb, { uid: 'u1', packId: 'pack_1000' }),
    ).rejects.toThrow('purchasesEnabled');
  });

  it('rejects unknown packId', async () => {
    await expect(
      createCoinCheckoutSession(mockDb, { uid: 'u1', packId: 'nonexistent_pack' }),
    ).rejects.toThrow('Invalid coin pack');
  });

  it('enforces monthly spending cap of €20', async () => {
    const currentMonth = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
    store.set('users/u_whale/wallet/main', {
      balance: 10000,
      buckets: { trivia: 0, town: 0, purchased: 10000, gift: 0 },
      monthPurchasedEUR: 19.99,
      monthKey: currentMonth,
      locked: false,
    });

    await expect(
      createCoinCheckoutSession(mockDb, { uid: 'u_whale', packId: 'pack_1000' }),
    ).rejects.toThrow('Monthly purchase limit reached');
  });

  it('allows purchase when user has spent 0 or is within €20 limit', async () => {
    const res = await createCoinCheckoutSession(mockDb, {
      uid: 'u1',
      packId: 'pack_2800',
    });

    expect(res.sessionId).toBeDefined();
    expect(res.mode).toBe('test_simulation');
  });

  it('processes coin purchase atomically and credits purchased bucket', async () => {
    const res = await processSuccessfulCoinPurchase(mockDb, {
      sessionId: 'cs_test_123',
      uid: 'u_buyer',
      packId: 'pack_2800',
      coins: 2800,
      eur: 4.99,
    });

    expect(res.processed).toBe(true);
    expect(res.balanceAfter).toBe(2800);

    const wallet = store.get('users/u_buyer/wallet/main');
    expect(wallet?.balance).toBe(2800);
    expect((wallet?.buckets as any).purchased).toBe(2800);
    expect(wallet?.monthPurchasedEUR).toBe(4.99);

    const purchase = store.get('coinPurchases/cs_test_123');
    expect(purchase).toBeDefined();
    expect(purchase?.coins).toBe(2800);
    expect(purchase?.eur).toBe(4.99);

    // Second execution with same sessionId is idempotent
    const res2 = await processSuccessfulCoinPurchase(mockDb, {
      sessionId: 'cs_test_123',
      uid: 'u_buyer',
      packId: 'pack_2800',
      coins: 2800,
      eur: 4.99,
    });
    expect(res2.processed).toBe(false);
    expect(res2.balanceAfter).toBe(2800);
  });

  it('handles dedicated webhook event safely and idempotently', async () => {
    const stripeEvent = {
      id: 'evt_test_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_stripe_hook_999',
          metadata: {
            type: 'town_coin_purchase',
            uid: 'u_hook_user',
            packId: 'pack_1000',
            coins: '1000',
            eur: '1.99',
          },
        },
      },
    };

    const webhookResult = await handleTownStripeWebhook(mockDb, stripeEvent);
    expect(webhookResult.processed).toBe(true);

    const wallet = store.get('users/u_hook_user/wallet/main');
    expect(wallet?.balance).toBe(1000);
    expect((wallet?.buckets as any).purchased).toBe(1000);

    // Non-town stripe event is ignored safely
    const subEvent = {
      type: 'customer.subscription.updated',
      data: { object: {} },
    };
    const subRes = await handleTownStripeWebhook(mockDb, subEvent);
    expect(subRes.processed).toBe(false);
  });

  afterEach(() => {
    if (origEmulator === undefined) delete process.env.FUNCTIONS_EMULATOR;
    else process.env.FUNCTIONS_EMULATOR = origEmulator;
    if (origStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = origStripeKey;
  });

  it('throws in production when Stripe is unavailable or errors and never falls back to simulation', async () => {
    delete process.env.FUNCTIONS_EMULATOR;
    delete process.env.STRIPE_SECRET_KEY;

    await expect(
      createCoinCheckoutSession(mockDb, {
        uid: 'u_prod',
        packId: 'pack_1000',
        simulateImmediately: true,
      }),
    ).rejects.toThrow('STRIPE_NOT_CONFIGURED');

    // When Stripe client exists in production and sessions.create rejects, propagate error (no simulation)
    const spy = vi.spyOn(stripeClient, 'getStripe').mockReturnValue({
      checkout: {
        sessions: {
          create: vi.fn().mockRejectedValue(new Error('Stripe API 500')),
        },
      },
    } as any);
    try {
      await expect(
        createCoinCheckoutSession(mockDb, {
          uid: 'u_prod',
          packId: 'pack_1000',
          simulateImmediately: true,
        }),
      ).rejects.toThrow('Stripe API 500');
    } finally {
      spy.mockRestore();
    }

    // No coins credited by silent simulation fallback
    expect(store.get('users/u_prod/wallet/main')).toBeUndefined();
  });
});
