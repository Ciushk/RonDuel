import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it } from 'vitest';
import { createStrictMockFirestore } from './test-firestore-helper.js';
import { clearEconomyConfigCache } from './town-economy.js';
import { deliverOrder, getOrCreateDailyOrders, harvestCrop, plantCrop } from './town-farming.js';

describe('town-farming server business logic', () => {
  let store: Map<string, Record<string, unknown>>;
  let mockDb: any;

  beforeEach(() => {
    clearEconomyConfigCache();
    store = new Map();
    store.set('config/townEconomy', {
      enabled: true,
      purchasesEnabled: false,
      transfersEnabled: false,
      helpEnabled: false,
      dailyOrders: { free: 3, pro: 5 },
    });

    mockDb = createStrictMockFirestore(store);

    // User setup
    store.set('users/u1', { pro: { active: false } });
    store.set('users/u1/wallet/main', {
      balance: 100,
      buckets: { trivia: 0, town: 100, purchased: 0, gift: 0 },
      monthPurchasedEUR: 0,
      monthKey: '2026-11',
      locked: false,
    });
    store.set('users/u1/town/main', {
      gridSize: 8,
      population: 2,
      maxLevelReached: 1,
      tutorialStep: 0,
    });
    store.set('users/u1/townTiles/3_4', { itemId: 'plot', x: 3, y: 4 });
  });

  describe('plantCrop', () => {
    it('plants oats on plot, debits seed coins (2), sets timestamps and advances tutorial', async () => {
      const res = await plantCrop(mockDb, 'u1', { x: 3, y: 4, cropId: 'oats' });
      expect(res.success).toBe(true);
      expect(res.tile.cropId).toBe('oats');
      expect(res.tile.readyAt).toBeDefined();

      const wallet = store.get('users/u1/wallet/main') as any;
      expect(wallet.balance).toBe(98); // 100 - 2

      const town = store.get('users/u1/town/main') as any;
      expect(town.tutorialStep).toBe(1);
    });

    it('rejects planting a crop that requires a higher Town Level', async () => {
      // Carrots require Lv2, player is Lv1
      await expect(plantCrop(mockDb, 'u1', { x: 3, y: 4, cropId: 'carrots' })).rejects.toThrow(
        'requires Town Level 2',
      );
    });

    it('rejects planting on an already planted plot', async () => {
      await plantCrop(mockDb, 'u1', { x: 3, y: 4, cropId: 'oats' });
      await expect(plantCrop(mockDb, 'u1', { x: 3, y: 4, cropId: 'wheat' })).rejects.toThrow(
        'already has a growing crop',
      );
    });

    it('plants cabbage directly on an owned grass tile and converts ground to dirt', async () => {
      store.set('users/u1/town/main', {
        gridSize: 8,
        population: 2,
        maxLevelReached: 1,
        tutorialStep: 1,
        land: { '3_3': 'basic-block', '2_3': 'basic-block' },
      });

      const res = await plantCrop(mockDb, 'u1', { x: 2, y: 3, cropId: 'cabbage' });
      expect(res.success).toBe(true);
      expect(res.tile.cropId).toBe('cabbage');
      expect(res.tile.itemId).toBe('plot');

      const town = store.get('users/u1/town/main') as any;
      expect(town.land['2_3']).toBe('basic-block-dirt');

      const wallet = store.get('users/u1/wallet/main') as any;
      expect(wallet.balance).toBe(95); // 100 - 5
    });
  });

  describe('harvestCrop', () => {
    it('refuses harvest if crop is not ready yet (server authoritative readyAt)', async () => {
      await plantCrop(mockDb, 'u1', { x: 3, y: 4, cropId: 'oats' });
      await expect(harvestCrop(mockDb, 'u1', { x: 3, y: 4 })).rejects.toThrow('still growing');
    });

    it('harvests crop when readyAt has passed and credits yield (2) to inventory', async () => {
      // Set plot with a crop ready in the past
      const pastSeconds = Math.floor(Date.now() / 1000) - 100;
      store.set('users/u1/townTiles/3_4', {
        itemId: 'plot',
        x: 3,
        y: 4,
        cropId: 'oats',
        readyAt: Timestamp.fromMillis(pastSeconds * 1000),
      });

      const res = await harvestCrop(mockDb, 'u1', { x: 3, y: 4 });
      expect(res.success).toBe(true);
      expect(res.cropId).toBe('oats');
      expect(res.yieldCount).toBe(2);

      // Inventory check
      const inv = store.get('users/u1/townInventory/main') as any;
      expect(inv.crops.oats).toBe(2);

      // Plot reset
      const tile = store.get('users/u1/townTiles/3_4') as any;
      expect(tile.cropId).toBeUndefined();
    });
  });

  describe('daily orders and delivery', () => {
    it('provisions 3 orders for free player and 5 for Pro player', async () => {
      const freeOrders = await getOrCreateDailyOrders(mockDb, 'u1', '2026-11-24');
      expect(freeOrders.orders).toHaveLength(3);

      store.set('users/u_pro', { pro: { active: true } });
      const proOrders = await getOrCreateDailyOrders(mockDb, 'u_pro', '2026-11-24');
      expect(proOrders.orders).toHaveLength(5);
    });

    it('delivers order: validates inventory, deducts crops, and credits reward coins', async () => {
      // Setup orders doc
      store.set('users/u1/townOrders/2026-11-24', {
        unlocked: true,
        orders: [
          {
            id: 'ord_1',
            templateKey: 'bakers_basket',
            items: { wheat: 2 },
            rewardCoins: 25,
            rewardXp: 10,
            done: false,
          },
        ],
      });

      // Try delivering before inventory has wheat -> fails
      await expect(
        deliverOrder(mockDb, 'u1', { roundDate: '2026-11-24', orderId: 'ord_1' }),
      ).rejects.toThrow('Insufficient crops');

      // Add 2 wheat to inventory
      store.set('users/u1/townInventory/main', { crops: { wheat: 3 } });

      const res = await deliverOrder(mockDb, 'u1', { roundDate: '2026-11-24', orderId: 'ord_1' });
      expect(res.success).toBe(true);
      expect(res.rewardCoins).toBe(25);

      // Inventory deducted (3 - 2 = 1)
      const inv = store.get('users/u1/townInventory/main') as any;
      expect(inv.crops.wheat).toBe(1);

      // Wallet credited +25 (100 + 25 = 125)
      const wallet = store.get('users/u1/wallet/main') as any;
      expect(wallet.balance).toBe(125);

      // Order marked done
      const ordersDoc = store.get('users/u1/townOrders/2026-11-24') as any;
      expect(ordersDoc.orders[0].done).toBe(true);
    });
  });
});
