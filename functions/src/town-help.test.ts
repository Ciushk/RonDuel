import { beforeEach, describe, expect, it } from 'vitest';
import { clearEconomyConfigCache } from './town-economy.js';
import { getFriendWaterStatus, waterFriendCrop } from './town-help.js';
import { Timestamp } from 'firebase-admin/firestore';

describe('town-help crop watering business logic', () => {
  let store: Map<string, Record<string, unknown>>;
  let mockDb: any;

  beforeEach(() => {
    clearEconomyConfigCache();
    store = new Map();

    store.set('config/townEconomy', {
      enabled: true,
      purchasesEnabled: false,
      transfersEnabled: false,
      helpEnabled: true,
      help: {
        actionsPerFriendPerDay: 3,
        waterReducesSeconds: 1800,
        helperRewardCoins: 1,
        helperDailyCap: 5,
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
            update: async (val: any) => {
              const prev = store.get(docPath) || {};
              store.set(docPath, { ...prev, ...val });
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
                    update: async (val: any) => {
                      const prev = store.get(subDocPath) || {};
                      store.set(subDocPath, { ...prev, ...val });
                    },
                  };
                },
                get: async () => {
                  const docs: any[] = [];
                  for (const [p, d] of store.entries()) {
                    if (p.startsWith(`${subPrefix}/`)) {
                      docs.push({ id: p.slice(subPrefix.length + 1), data: () => d });
                    }
                  }
                  return { docs };
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

  it('rejects watering when helpEnabled kill-switch is false', async () => {
    store.set('config/townEconomy', {
      enabled: true,
      helpEnabled: false,
    });

    await expect(
      waterFriendCrop(mockDb, { helperUid: 'u_helper', hostUid: 'u_host', tileX: 3, tileY: 4 }),
    ).rejects.toThrow('helpEnabled');
  });

  it('rejects helper attempting to water own crop for rewards', async () => {
    store.set('users/u_self', { leagueIds: ['lg_1'] });

    await expect(
      waterFriendCrop(mockDb, { helperUid: 'u_self', hostUid: 'u_self', tileX: 3, tileY: 4 }),
    ).rejects.toThrow('cannot water your own crops');
  });

  it('rejects watering when users are not in same league', async () => {
    store.set('users/u_helper', { leagueIds: ['lg_1'] });
    store.set('users/u_host', { leagueIds: ['lg_other'] });

    await expect(
      waterFriendCrop(mockDb, { helperUid: 'u_helper', hostUid: 'u_host', tileX: 3, tileY: 4 }),
    ).rejects.toThrow('same league');
  });

  it('rejects watering if tile is already ready to harvest', async () => {
    store.set('users/u_helper', { leagueIds: ['lg_1'] });
    store.set('users/u_host', { leagueIds: ['lg_1'] });
    store.set('users/u_host/townTiles/3_4', {
      itemId: 'plot',
      cropId: 'wheat',
      readyAt: Timestamp.fromMillis(1000), // already in the past
    });

    await expect(
      waterFriendCrop(mockDb, { helperUid: 'u_helper', hostUid: 'u_host', tileX: 3, tileY: 4 }),
    ).rejects.toThrow('already fully grown');
  });

  it('reduces grow time by 30 mins (1800s) and credits helper 1 coin', async () => {
    store.set('users/u_helper', { leagueIds: ['lg_1'] });
    store.set('users/u_host', { leagueIds: ['lg_1'] });

    const now = new Date(1700000000 * 1000);
    const initialReadyAtSeconds = 1700000000 + 7200; // 2 hours in future

    store.set('users/u_host/townTiles/3_4', {
      itemId: 'plot',
      cropId: 'wheat',
      readyAt: Timestamp.fromMillis(initialReadyAtSeconds * 1000),
      waterCount: 0,
    });

    const res = await waterFriendCrop(mockDb, {
      helperUid: 'u_helper',
      hostUid: 'u_host',
      tileX: 3,
      tileY: 4,
      now,
    });

    expect(res.success).toBe(true);
    expect(res.reducedSeconds).toBe(1800);
    expect(res.helperRewarded).toBe(true);
    expect(res.newReadyAtSeconds).toBe(initialReadyAtSeconds - 1800);

    // Verify tile in store
    const tile = store.get('users/u_host/townTiles/3_4');
    expect(tile?.waterCount).toBe(1);

    // Verify helper wallet credited 1 coin to town bucket
    const helperWallet = store.get('users/u_helper/wallet/main');
    expect(helperWallet?.balance).toBe(1);
    expect((helperWallet?.buckets as any).town).toBe(1);

    // Check status
    const status = await getFriendWaterStatus(mockDb, 'u_helper', 'u_host', now);
    expect(status.actionsUsed).toBe(1);
    expect(status.remaining).toBe(2);
  });

  it('enforces limit of 3 helps per friend per day', async () => {
    store.set('users/u_helper', { leagueIds: ['lg_1'] });
    store.set('users/u_host', { leagueIds: ['lg_1'] });

    const now = new Date(1700000000 * 1000);
    const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

    store.set(`users/u_helper/townHelpFriends/u_host_${today}`, {
      actionCount: 3,
    });

    store.set('users/u_host/townTiles/3_4', {
      itemId: 'plot',
      cropId: 'wheat',
      readyAt: Timestamp.fromMillis((1700000000 + 7200) * 1000),
    });

    await expect(
      waterFriendCrop(mockDb, {
        helperUid: 'u_helper',
        hostUid: 'u_host',
        tileX: 3,
        tileY: 4,
        now,
      }),
    ).rejects.toThrow('limit of 3 helps for this friend today');
  });
});
