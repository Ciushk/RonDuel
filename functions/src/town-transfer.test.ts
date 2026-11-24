import { beforeEach, describe, expect, it } from 'vitest';
import { clearEconomyConfigCache } from './town-economy.js';
import { getTransferStatus, transferCoins } from './town-transfer.js';

describe('town-transfer business logic', () => {
  let store: Map<string, Record<string, unknown>>;
  let mockDb: any;

  beforeEach(() => {
    clearEconomyConfigCache();
    store = new Map();

    store.set('config/townEconomy', {
      enabled: true,
      purchasesEnabled: false,
      transfersEnabled: true,
      helpEnabled: false,
      transfer: {
        proSenderOnly: true,
        sourceBucket: 'trivia',
        dailyCapSender: 50,
        monthlyCapReceiver: 500,
        sameLeagueOnly: true,
        minAccountAgeDays: 7,
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

  const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();

  it('rejects transfer when transfersEnabled kill-switch is false', async () => {
    store.set('config/townEconomy', {
      enabled: true,
      transfersEnabled: false,
    });

    await expect(
      transferCoins(mockDb, { senderUid: 'u_sender', receiverUid: 'u_rec', amount: 10 }),
    ).rejects.toThrow('transfersEnabled');
  });

  it('rejects transfer when sender is not Pro', async () => {
    store.set('users/u_sender', {
      pro: { active: false },
      createdAt: tenDaysAgo,
      leagueIds: ['lg_1'],
    });
    store.set('users/u_rec', {
      leagueIds: ['lg_1'],
    });

    await expect(
      transferCoins(mockDb, { senderUid: 'u_sender', receiverUid: 'u_rec', amount: 10 }),
    ).rejects.toThrow('requires an active Pro subscription');
  });

  it('rejects transfer when sender account is less than 7 days old', async () => {
    store.set('users/u_sender', {
      pro: { active: true },
      createdAt: twoDaysAgo,
      leagueIds: ['lg_1'],
    });
    store.set('users/u_rec', {
      leagueIds: ['lg_1'],
    });

    await expect(
      transferCoins(mockDb, { senderUid: 'u_sender', receiverUid: 'u_rec', amount: 10 }),
    ).rejects.toThrow('must be at least 7 days old');
  });

  it('rejects transfer when sender and recipient are not in same league', async () => {
    store.set('users/u_sender', {
      pro: { active: true },
      createdAt: tenDaysAgo,
      leagueIds: ['lg_sender'],
    });
    store.set('users/u_rec', {
      leagueIds: ['lg_other'],
    });

    await expect(
      transferCoins(mockDb, { senderUid: 'u_sender', receiverUid: 'u_rec', amount: 10 }),
    ).rejects.toThrow('same league');
  });

  it('rejects transfer when sender has insufficient trivia-bucket coins', async () => {
    store.set('users/u_sender', {
      pro: { active: true },
      createdAt: tenDaysAgo,
      leagueIds: ['lg_1'],
    });
    store.set('users/u_rec', {
      leagueIds: ['lg_1'],
    });
    // Wallet has 1000 total coins, but only 5 in trivia bucket!
    store.set('users/u_sender/wallet/main', {
      balance: 1000,
      buckets: { trivia: 5, town: 500, purchased: 495, gift: 0 },
      locked: false,
    });

    await expect(
      transferCoins(mockDb, { senderUid: 'u_sender', receiverUid: 'u_rec', amount: 20 }),
    ).rejects.toThrow('Insufficient trivia coins');
  });

  it('rejects transfer when sender daily limit (50 coins) is exceeded', async () => {
    store.set('users/u_sender', {
      pro: { active: true },
      createdAt: tenDaysAgo,
      leagueIds: ['lg_1'],
    });
    store.set('users/u_rec', {
      leagueIds: ['lg_1'],
    });
    store.set('users/u_sender/wallet/main', {
      balance: 100,
      buckets: { trivia: 100, town: 0, purchased: 0, gift: 0 },
      locked: false,
    });

    const now = new Date();
    const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    store.set(`users/u_sender/townTransferDaily/${today}`, { totalSent: 45 });

    await expect(
      transferCoins(mockDb, { senderUid: 'u_sender', receiverUid: 'u_rec', amount: 10, now }),
    ).rejects.toThrow('Daily transfer cap reached');
  });

  it('rejects transfer when recipient monthly limit (500 coins) is exceeded', async () => {
    store.set('users/u_sender', {
      pro: { active: true },
      createdAt: tenDaysAgo,
      leagueIds: ['lg_1'],
    });
    store.set('users/u_rec', {
      leagueIds: ['lg_1'],
    });
    store.set('users/u_sender/wallet/main', {
      balance: 100,
      buckets: { trivia: 100, town: 0, purchased: 0, gift: 0 },
      locked: false,
    });

    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    store.set(`users/u_rec/townTransferMonthly/${month}`, { totalReceived: 495 });

    await expect(
      transferCoins(mockDb, { senderUid: 'u_sender', receiverUid: 'u_rec', amount: 10, now }),
    ).rejects.toThrow("Friend's monthly gift cap reached");
  });

  it('executes valid transfer: debits trivia bucket and credits gift bucket atomically', async () => {
    store.set('users/u_sender', {
      pro: { active: true },
      createdAt: tenDaysAgo,
      leagueIds: ['lg_1'],
    });
    store.set('users/u_rec', {
      leagueIds: ['lg_1'],
    });
    store.set('users/u_sender/wallet/main', {
      balance: 100,
      buckets: { trivia: 70, town: 30, purchased: 0, gift: 0 },
      locked: false,
    });
    store.set('users/u_rec/wallet/main', {
      balance: 10,
      buckets: { trivia: 10, town: 0, purchased: 0, gift: 0 },
      locked: false,
    });

    const now = new Date();
    const res = await transferCoins(mockDb, {
      senderUid: 'u_sender',
      receiverUid: 'u_rec',
      amount: 25,
      now,
    });

    expect(res.success).toBe(true);
    expect(res.senderBalanceAfter).toBe(75);

    // Sender's trivia bucket is debited by 25
    const senderWallet = store.get('users/u_sender/wallet/main');
    expect(senderWallet?.balance).toBe(75);
    expect((senderWallet?.buckets as any).trivia).toBe(45);
    expect((senderWallet?.buckets as any).town).toBe(30);

    // Receiver's gift bucket is credited with 25
    const receiverWallet = store.get('users/u_rec/wallet/main');
    expect(receiverWallet?.balance).toBe(35);
    expect((receiverWallet?.buckets as any).gift).toBe(25);
    expect((receiverWallet?.buckets as any).trivia).toBe(10);

    // Check sender status
    const status = await getTransferStatus(mockDb, 'u_sender', now);
    expect(status.dailySent).toBe(25);
    expect(status.dailyRemaining).toBe(25);
  });
});
