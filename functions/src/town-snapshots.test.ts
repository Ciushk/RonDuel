import { beforeEach, describe, expect, it } from 'vitest';
import { clearEconomyConfigCache } from './town-economy.js';
import { publishTownSnapshot, getTownVisit, likeTown } from './town-snapshots.js';

describe('town-snapshots business logic', () => {
  let store: Map<string, Record<string, unknown>>;
  let mockDb: any;

  beforeEach(() => {
    clearEconomyConfigCache();
    store = new Map();
    // Default economy enabled
    store.set('config/townEconomy', {
      enabled: true,
      purchasesEnabled: false,
      transfersEnabled: false,
      helpEnabled: false,
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
              const next = { ...prev };
              for (const [k, v] of Object.entries(val)) {
                if (
                  typeof v === 'object' &&
                  (v as any)?.constructor?.name === 'NumericIncrementTransform'
                ) {
                  next[k] = ((next[k] as number) || 0) + 1;
                } else {
                  next[k] = v;
                }
              }
              store.set(docPath, next);
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
                    collection: (deepCol: string) => {
                      const deepPrefix = `${subDocPath}/${deepCol}`;
                      return {
                        doc: (deepId: string) => ({
                          path: `${deepPrefix}/${deepId}`,
                          get: async () => {
                            const data = store.get(`${deepPrefix}/${deepId}`);
                            return { exists: data !== undefined, data: () => data };
                          },
                        }),
                        get: async () => {
                          const docs: any[] = [];
                          for (const [p, d] of store.entries()) {
                            if (p.startsWith(`${deepPrefix}/`)) {
                              docs.push({ id: p.slice(deepPrefix.length + 1), data: () => d });
                            }
                          }
                          return { docs };
                        },
                      };
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
              if (
                typeof v === 'object' &&
                (v as any)?.constructor?.name === 'NumericIncrementTransform'
              ) {
                next[k] = ((next[k] as number) || 0) + 1;
              } else {
                next[k] = v;
              }
            }
            store.set(ref.path, next);
          },
        };
        return fn(tx);
      },
    };
  });

  it('publishes town snapshot from user town state and tiles', async () => {
    store.set('users/user_1', { nickname: 'Mayor Alice', leagueIds: ['lg_1', 'lg_2'] });
    store.set('users/user_1/town/main', { level: 2, population: 10, likesCount: 3 });
    store.set('users/user_1/townTiles/t1', {
      itemId: 'starter_house',
      x: 3,
      y: 3,
    });
    store.set('users/user_1/townTiles/t2', {
      itemId: 'farm_plot',
      x: 3,
      y: 4,
      cropId: 'wheat',
      readyAt: 1000,
    });

    await publishTownSnapshot(mockDb, 'user_1');

    const snap = store.get('townSnapshots/user_1');
    expect(snap).toBeDefined();
    expect(snap?.displayName).toBe('Mayor Alice');
    expect(snap?.level).toBe(2);
    expect(snap?.population).toBe(10);
    expect(snap?.likesCount).toBe(3);
    expect(snap?.leagueIds).toEqual(['lg_1', 'lg_2']);
    expect((snap?.tiles as any[]).length).toBe(2);
    expect((snap?.tiles as any[])[1].cropId).toBe('wheat');
    expect((snap?.tiles as any[])[1].ready).toBe(true);
  });

  it('allows owner to visit their own town snapshot', async () => {
    store.set('townSnapshots/user_1', {
      uid: 'user_1',
      displayName: 'Alice',
      level: 1,
      population: 2,
      leagueIds: ['lg_1'],
      tiles: [],
    });

    const res = await getTownVisit(mockDb, 'user_1', 'user_1');
    expect(res.snapshot.uid).toBe('user_1');
    expect(res.hasLiked).toBe(false);
  });

  it('allows league member to visit friend town snapshot', async () => {
    store.set('users/user_2', { leagueIds: ['lg_1'] });
    store.set('townSnapshots/user_1', {
      uid: 'user_1',
      displayName: 'Alice',
      level: 1,
      population: 2,
      leagueIds: ['lg_1', 'lg_2'],
      tiles: [],
    });

    const res = await getTownVisit(mockDb, 'user_1', 'user_2');
    expect(res.snapshot.uid).toBe('user_1');
    expect(res.hasLiked).toBe(false);
  });

  it('rejects visitor who is not in the same league', async () => {
    store.set('users/user_stranger', { leagueIds: ['lg_other'] });
    store.set('townSnapshots/user_1', {
      uid: 'user_1',
      displayName: 'Alice',
      level: 1,
      population: 2,
      leagueIds: ['lg_1'],
      tiles: [],
    });

    await expect(getTownVisit(mockDb, 'user_1', 'user_stranger')).rejects.toThrow(
      'Forbidden: You do not share a league with this player',
    );
  });

  it('allows a league friend to like town idempotently', async () => {
    store.set('users/user_friend', { leagueIds: ['lg_1'] });
    store.set('users/user_host/town/main', { likesCount: 0 });
    store.set('townSnapshots/user_host', {
      uid: 'user_host',
      displayName: 'Host',
      leagueIds: ['lg_1'],
      likesCount: 0,
    });

    const res1 = await likeTown(mockDb, 'user_host', 'user_friend');
    expect(res1.ok).toBe(true);
    expect(res1.likesCount).toBe(1);

    const visit = store.get('townVisits/user_host_user_friend');
    expect(visit?.liked).toBe(true);

    // Second like should be idempotent
    const res2 = await likeTown(mockDb, 'user_host', 'user_friend');
    expect(res2.ok).toBe(true);
    expect(res2.likesCount).toBe(1);
  });

  it('prevents user from liking their own town', async () => {
    store.set('users/user_1', { leagueIds: ['lg_1'] });
    store.set('townSnapshots/user_1', { uid: 'user_1', leagueIds: ['lg_1'] });

    await expect(likeTown(mockDb, 'user_1', 'user_1')).rejects.toThrow('Cannot like your own town');
  });

  it('respects server kill-switch (refuses visit when disabled)', async () => {
    store.set('config/townEconomy', { enabled: false });
    await expect(getTownVisit(mockDb, 'user_1', 'user_1')).rejects.toThrow(
      'RonTown is currently disabled by server configuration',
    );
  });
});
