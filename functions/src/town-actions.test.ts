import { beforeEach, describe, expect, it } from 'vitest';
import { createStrictMockFirestore } from './test-firestore-helper.js';
import { clearEconomyConfigCache } from './town-economy.js';
import { buildItem, buyFarmPlot, buyLandTile, moveTile, removeTile } from './town-actions.js';

describe('town-actions server business logic', () => {
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
      baseServiceCapacity: 4,
      removeRefundRate: 0.5,
      arrivalIntervalSeconds: 7200,
    });

    // Strict mock DB enforcing read-before-write transaction invariant
    mockDb = createStrictMockFirestore(store);

    // Setup user with 500 coins and basic town
    store.set('users/u1', { pro: { active: false }, streak: { length: 0 } });
    store.set('users/u1/wallet/main', {
      balance: 500,
      buckets: { trivia: 0, town: 500, purchased: 0, gift: 0 },
      monthPurchasedEUR: 0,
      monthKey: '2026-11',
      locked: false,
    });
    store.set('users/u1/town/main', {
      gridSize: 8,
      population: 2,
      housingCapacity: 2,
      serviceCapacity: 4,
      populationCap: 2,
      level: 1,
      maxLevelReached: 1,
      tutorialStep: 1,
      plotsOwned: 2,
    });
    store.set('users/u1/townTiles/3_3', { itemId: 'starter_house', x: 3, y: 3 });
  });

  describe('buildItem', () => {
    it('buys and places a cottage, debits wallet, updates housing and advances tutorial', async () => {
      const res = await buildItem(mockDb, 'u1', { itemId: 'cottage', x: 1, y: 1 });
      expect(res.success).toBe(true);
      expect(res.town.housingCapacity).toBe(4); // 2 starter + 2 cottage
      expect(res.town.tutorialStep).toBe(2);

      // Wallet was debited 60 coins (500 - 60 = 440)
      const wallet = store.get('users/u1/wallet/main') as any;
      expect(wallet.balance).toBe(440);

      // Tile placed
      const tile = store.get('users/u1/townTiles/1_1');
      expect(tile?.itemId).toBe('cottage');
    });

    it('stores rot: 1 only for road items and silently ignores other values or non-road items', async () => {
      const roadRot = await buildItem(mockDb, 'u1', { itemId: 'road', x: 1, y: 2, rot: 1 });
      expect(roadRot.tile.rot).toBe(1);
      expect(store.get('users/u1/townTiles/1_2')?.rot).toBe(1);

      const roadDefault = await buildItem(mockDb, 'u1', { itemId: 'road', x: 2, y: 2, rot: 0 });
      expect(roadDefault.tile.rot).toBeUndefined();
      expect(store.get('users/u1/townTiles/2_2')?.rot).toBeUndefined();

      const roadIgnored = await buildItem(mockDb, 'u1', { itemId: 'road', x: 2, y: 1, rot: 99 });
      expect(roadIgnored.tile.rot).toBeUndefined();

      const cottageIgnored = await buildItem(mockDb, 'u1', {
        itemId: 'cottage',
        x: 0,
        y: 0,
        rot: 1,
      });
      expect(cottageIgnored.tile.rot).toBeUndefined();
      expect(store.get('users/u1/townTiles/0_0')?.rot).toBeUndefined();
    });

    it('rejects building when funds are insufficient', async () => {
      // Villa costs 750 coins, player has 500
      // Unlock level 4 is also needed, let's set level 4 to test insufficient funds
      store.set('users/u1/town/main', {
        gridSize: 10,
        population: 50,
        housingCapacity: 50,
        serviceCapacity: 50,
        populationCap: 50,
        level: 4,
        maxLevelReached: 4,
        plotsOwned: 2,
      });

      await expect(buildItem(mockDb, 'u1', { itemId: 'villa', x: 5, y: 5 })).rejects.toThrow(
        'INSUFFICIENT_FUNDS',
      );
    });

    it('rejects placement collision with existing tile', async () => {
      // 3_3 is occupied by starter_house
      await expect(buildItem(mockDb, 'u1', { itemId: 'cottage', x: 3, y: 3 })).rejects.toThrow(
        'already occupied',
      );
    });

    it('rejects building when level is too low', async () => {
      // Villa requires Lv4, player is Lv1
      await expect(buildItem(mockDb, 'u1', { itemId: 'villa', x: 0, y: 0 })).rejects.toThrow(
        'requires Town Level 4',
      );
    });

    it('rejects Pro-only building if user is not Pro', async () => {
      // golden_fountain requires Pro
      store.set('users/u1/town/main', {
        gridSize: 8,
        population: 10,
        level: 2,
        maxLevelReached: 2,
        plotsOwned: 2,
      });
      await expect(
        buildItem(mockDb, 'u1', { itemId: 'golden_fountain', x: 0, y: 0 }),
      ).rejects.toThrow('Pro subscription');
    });

    it('rejects streak-unlock building if user streak is insufficient', async () => {
      // Windmill requires 7-day streak
      await expect(buildItem(mockDb, 'u1', { itemId: 'windmill', x: 0, y: 0 })).rejects.toThrow(
        '7-day streak',
      );
    });

    it('enforces maxCount for Town Hall (max 1)', async () => {
      // Place first town hall
      await buildItem(mockDb, 'u1', { itemId: 'town_hall', x: 0, y: 0 });
      // Second town hall must fail
      await expect(buildItem(mockDb, 'u1', { itemId: 'town_hall', x: 4, y: 0 })).rejects.toThrow(
        'Maximum limit of 1 reached',
      );
    });
  });

  describe('removeTile', () => {
    it('refuses to remove the Starter House', async () => {
      await expect(removeTile(mockDb, 'u1', { x: 3, y: 3 })).rejects.toThrow(
        'Starter House cannot be removed',
      );
    });

    it('removes cottage, refunds 50% coins to town bucket, and recalculates capacities', async () => {
      await buildItem(mockDb, 'u1', { itemId: 'cottage', x: 1, y: 1 });
      const walletBefore = store.get('users/u1/wallet/main') as any;
      expect(walletBefore.balance).toBe(440);

      // Remove cottage (cost 60 -> 50% refund = 30)
      const res = await removeTile(mockDb, 'u1', { x: 1, y: 1 });
      expect(res.success).toBe(true);
      expect(res.refundCoins).toBe(30);

      const walletAfter = store.get('users/u1/wallet/main') as any;
      expect(walletAfter.balance).toBe(470); // 440 + 30

      expect(store.has('users/u1/townTiles/1_1')).toBe(false);

      const town = store.get('users/u1/town/main') as any;
      expect(town.housingCapacity).toBe(2); // Reduced back to starter house
    });
  });

  describe('moveTile', () => {
    it('moves a tile to a free coordinate within bounds', async () => {
      await buildItem(mockDb, 'u1', { itemId: 'cottage', x: 1, y: 1 });
      const res = await moveTile(mockDb, 'u1', { fromX: 1, fromY: 1, toX: 5, toY: 5 });
      expect(res.success).toBe(true);

      expect(store.has('users/u1/townTiles/1_1')).toBe(false);
      const moved = store.get('users/u1/townTiles/5_5');
      expect(moved?.itemId).toBe('cottage');
      expect(moved?.x).toBe(5);
      expect(moved?.y).toBe(5);
    });

    it('rejects move if target is occupied', async () => {
      await buildItem(mockDb, 'u1', { itemId: 'cottage', x: 1, y: 1 });
      // 3_3 is occupied by starter_house
      await expect(moveTile(mockDb, 'u1', { fromX: 1, fromY: 1, toX: 3, toY: 3 })).rejects.toThrow(
        'already occupied',
      );
    });
  });

  describe('buyFarmPlot', () => {
    it('buys extra plot with escalating cost (25 for plot 3) and places plot tile', async () => {
      const res = await buyFarmPlot(mockDb, 'u1', { x: 0, y: 5 });
      expect(res.success).toBe(true);
      expect(res.cost).toBe(25);
      expect(res.plotsOwned).toBe(3);

      const tile = store.get('users/u1/townTiles/0_5');
      expect(tile?.itemId).toBe('plot');

      const wallet = store.get('users/u1/wallet/main') as any;
      expect(wallet.balance).toBe(475); // 500 - 25
    });

    it('rejects buying more than 12 plots', async () => {
      store.set('users/u1/town/main', {
        gridSize: 8,
        plotsOwned: 12,
      });
      await expect(buyFarmPlot(mockDb, 'u1', { x: 0, y: 5 })).rejects.toThrow(
        'Maximum of 12 farm plots already reached',
      );
    });
  });

  describe('buyLandTile', () => {
    it('purchases an adjacent expand-ring flowers tile at unchanged cost (25), debits wallet, and updates town.land', async () => {
      store.set('users/u1/town/main', {
        gridSize: 8,
        population: 2,
        level: 1,
        maxLevelReached: 1,
        plotsOwned: 2,
        land: { '3_3': 'basic-block', '3_4': 'basic-block' },
      });

      const res = await buyLandTile(mockDb, 'u1', {
        x: 4,
        y: 3,
        groundType: 'basic-block-flowers',
      });
      expect(res.success).toBe(true);
      expect(res.cost).toBe(25);
      expect(res.land['4_3']).toBe('basic-block-flowers');

      const wallet = store.get('users/u1/wallet/main') as any;
      expect(wallet.balance).toBe(475); // 500 - 25
    });

    it('purchases street and water ground tiles at 2 RonCoins each', async () => {
      store.set('users/u1/town/main', {
        gridSize: 8,
        population: 2,
        level: 1,
        maxLevelReached: 1,
        plotsOwned: 2,
        land: { '3_3': 'basic-block', '3_4': 'basic-block' },
      });

      const streetRes = await buyLandTile(mockDb, 'u1', {
        x: 4,
        y: 3,
        groundType: 'basic-block-street',
      });
      expect(streetRes.success).toBe(true);
      expect(streetRes.cost).toBe(2);
      expect((store.get('users/u1/wallet/main') as { balance: number }).balance).toBe(498); // 500 - 2

      const waterRes = await buyLandTile(mockDb, 'u1', {
        x: 2,
        y: 3,
        groundType: 'basic-block-wather',
      });
      expect(waterRes.success).toBe(true);
      expect(waterRes.cost).toBe(2);
      expect((store.get('users/u1/wallet/main') as { balance: number }).balance).toBe(496); // 498 - 2
    });

    it('rejects buying a tile that is not adjacent to owned land', async () => {
      store.set('users/u1/town/main', {
        gridSize: 8,
        land: { '3_3': 'basic-block' },
      });

      await expect(
        buyLandTile(mockDb, 'u1', { x: 0, y: 0, groundType: 'basic-block' }),
      ).rejects.toThrow('adjacent to owned land');
    });

    it('rejects building on unowned land or water when town has a land map', async () => {
      store.set('users/u1/town/main', {
        gridSize: 8,
        population: 2,
        housingCapacity: 2,
        serviceCapacity: 4,
        populationCap: 2,
        level: 1,
        maxLevelReached: 1,
        plotsOwned: 2,
        land: { '3_3': 'basic-block', '4_3': 'basic-block-wather' },
      });

      await expect(buildItem(mockDb, 'u1', { itemId: 'cottage', x: 0, y: 0 })).rejects.toThrow(
        'not owned land',
      );
      await expect(buildItem(mockDb, 'u1', { itemId: 'cottage', x: 4, y: 3 })).rejects.toThrow(
        'water or shoreline',
      );
    });
  });
});
