import { beforeEach, describe, expect, it } from 'vitest';
import { createStrictMockFirestore } from './test-firestore-helper.js';
import { clearEconomyConfigCache } from './town-economy.js';
import { initPlayerTown } from './town-init.js';

describe('town-init Cloud Function logic', () => {
  let store: Map<string, Record<string, unknown>>;
  let mockDb: any;

  beforeEach(() => {
    clearEconomyConfigCache();
    store = new Map();
    // Default economy enabled for test
    store.set('config/townEconomy', {
      enabled: true,
      purchasesEnabled: false,
      transfersEnabled: false,
      helpEnabled: false,
      starterCoins: 100,
      baseServiceCapacity: 4,
    });

    mockDb = createStrictMockFirestore(store);
  });

  it('initializes a brand new town with starting house, 2 plots, 2 villagers, and 100 starter coins', async () => {
    const result = await initPlayerTown(mockDb, 'user_new');
    expect(result.created).toBe(true);
    expect(result.town.gridSize).toBe(8);
    expect(result.town.population).toBe(2);
    expect(result.town.level).toBe(1);

    // Check tiles
    const house = store.get('users/user_new/townTiles/3_3');
    expect(house).toBeDefined();
    expect(house?.itemId).toBe('starter_house');

    const plot1 = store.get('users/user_new/townTiles/3_4');
    const plot2 = store.get('users/user_new/townTiles/4_4');
    expect(plot1?.itemId).toBe('plot');
    expect(plot2?.itemId).toBe('plot');

    // Check starter land (5-8 connected grass tiles covering starter tiles)
    const land = result.town.land;
    expect(land).toBeDefined();
    const landCount = Object.keys(land ?? {}).length;
    expect(landCount).toBeGreaterThanOrEqual(5);
    expect(landCount).toBeLessThanOrEqual(8);
    expect(land?.['3_3']).toBe('basic-block');
    expect(land?.['3_4']).toBe('basic-block');
    expect(land?.['4_4']).toBe('basic-block');

    // Check wallet has 100 coins in 'town' bucket
    const wallet = store.get('users/user_new/wallet/main') as any;
    expect(wallet).toBeDefined();
    expect(wallet.balance).toBe(100);
    expect(wallet.buckets.town).toBe(100);

    // Check ledger entry
    const ledgerKey = `ledger/${encodeURIComponent('starter:user_new')}`;
    const ledger = store.get(ledgerKey) as any;
    expect(ledger).toBeDefined();
    expect(ledger.delta).toBe(100);
    expect(ledger.bucket).toBe('town');
  });

  it('is strictly idempotent: returns existing town and does not re-grant starter coins', async () => {
    const first = await initPlayerTown(mockDb, 'user_existing');
    expect(first.created).toBe(true);

    const second = await initPlayerTown(mockDb, 'user_existing');
    expect(second.created).toBe(false);
    expect(second.town.gridSize).toBe(8);

    const wallet = store.get('users/user_existing/wallet/main') as any;
    expect(wallet.balance).toBe(100); // Not 200
  });

  it('throws when town economy is disabled via kill switch', async () => {
    store.set('config/townEconomy', { enabled: false });
    await expect(initPlayerTown(mockDb, 'user_blocked')).rejects.toThrow('disabled');
  });
});
