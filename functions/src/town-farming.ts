import { FieldValue, type Firestore, Timestamp } from 'firebase-admin/firestore';
import {
  DEFAULT_TOWN_CATALOG,
  type CatalogItem,
  type TownCatalogDoc,
  type TownDoc,
  type TownInventoryDoc,
  type TownOrderItem,
  type TownOrdersDoc,
  type TownTileDoc,
} from '@ronduel/shared';
import { assertTownFeatureEnabled } from './town-economy.js';
import { creditWallet, debitWallet } from './town-wallet.js';
import { publishTownSnapshot } from './town-snapshots.js';

export async function plantCrop(
  db: Firestore,
  uid: string,
  params: { x: number; y: number; cropId: string },
): Promise<{ success: boolean; tile: TownTileDoc }> {
  const economy = await assertTownFeatureEnabled(db);
  const catalog = DEFAULT_TOWN_CATALOG;
  const cropItem: CatalogItem | undefined = catalog.items[params.cropId];

  if (!cropItem || cropItem.type !== 'crop') {
    throw new Error(`Invalid crop type: ${params.cropId}`);
  }

  const tileRef = db
    .collection('users')
    .doc(uid)
    .collection('townTiles')
    .doc(`${params.x}_${params.y}`);
  const townRef = db.collection('users').doc(uid).collection('town').doc('main');

  const result = await db.runTransaction(async (tx) => {
    const townSnap = await tx.get(townRef);
    if (!townSnap.exists) {
      throw new Error('Town not initialized');
    }
    const townData = townSnap.data() as TownDoc;

    if (cropItem.unlockLevel > townData.maxLevelReached) {
      throw new Error(`Crop requires Town Level ${cropItem.unlockLevel}`);
    }

    const tileSnap = await tx.get(tileRef);
    if (!tileSnap.exists) {
      throw new Error(`No farm plot at (${params.x}, ${params.y})`);
    }
    const tileData = tileSnap.data() as TownTileDoc;

    if (tileData.itemId !== 'plot') {
      throw new Error('Crops can only be planted on farm plots');
    }
    if (tileData.cropId) {
      throw new Error('This farm plot already has a growing crop');
    }

    // Debit seed price
    if (cropItem.priceCoins > 0) {
      await debitWallet({
        transaction: tx,
        db,
        uid,
        amount: cropItem.priceCoins,
        reason: 'spend',
        refId: params.cropId,
        idempotencyKey: `plant:${uid}:${params.x}_${params.y}_${Date.now()}`,
      });
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const growSeconds = cropItem.growTimeSeconds ?? 14400;
    const readyAtSeconds = nowSeconds + growSeconds;

    const updatedTile: TownTileDoc = {
      ...tileData,
      cropId: params.cropId,
      plantedAt: Timestamp.fromMillis(nowSeconds * 1000),
      readyAt: Timestamp.fromMillis(readyAtSeconds * 1000),
      waterCount: 0,
    };

    tx.update(tileRef, { ...updatedTile });

    // Advance tutorial step 0 (plant oats)
    if (townData.tutorialStep === 0 && params.cropId === 'oats') {
      tx.update(townRef, {
        tutorialStep: 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      success: true,
      tile: updatedTile,
    };
  });

  await publishTownSnapshot(db, uid).catch(() => {});
  return result;
}

export async function harvestCrop(
  db: Firestore,
  uid: string,
  params: { x: number; y: number },
): Promise<{ success: boolean; cropId: string; yieldCount: number }> {
  await assertTownFeatureEnabled(db);
  const catalog = DEFAULT_TOWN_CATALOG;

  const tileRef = db
    .collection('users')
    .doc(uid)
    .collection('townTiles')
    .doc(`${params.x}_${params.y}`);
  const inventoryRef = db.collection('users').doc(uid).collection('townInventory').doc('main');

  const result = await db.runTransaction(async (tx) => {
    const tileSnap = await tx.get(tileRef);
    if (!tileSnap.exists) {
      throw new Error(`No tile at (${params.x}, ${params.y})`);
    }
    const tileData = tileSnap.data() as TownTileDoc;

    if (!tileData.cropId) {
      throw new Error('No crop on this plot to harvest');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const readySeconds = tileData.readyAt ? (tileData.readyAt as Timestamp).seconds : 0;

    if (nowSeconds < readySeconds) {
      const remainingSeconds = readySeconds - nowSeconds;
      throw new Error(`Crop is still growing. ${remainingSeconds}s remaining.`);
    }

    const cropId = tileData.cropId;
    const cropItem = catalog.items[cropId];
    const yieldCount = cropItem?.yieldCount ?? 2;

    // Reset plot
    tx.update(tileRef, {
      cropId: FieldValue.delete(),
      plantedAt: FieldValue.delete(),
      readyAt: FieldValue.delete(),
      waterCount: FieldValue.delete(),
    });

    // Add harvest to inventory
    const invSnap = await tx.get(inventoryRef);
    let cropsMap: Record<string, number> = {};
    if (invSnap.exists) {
      const invData = invSnap.data() as TownInventoryDoc;
      cropsMap = { ...(invData.crops || {}) };
    }
    cropsMap[cropId] = (cropsMap[cropId] || 0) + yieldCount;

    tx.set(inventoryRef, { crops: cropsMap }, { merge: true });

    return {
      success: true,
      cropId,
      yieldCount,
    };
  });

  await publishTownSnapshot(db, uid).catch(() => {});
  return result;
}

const ORDER_TEMPLATES: Record<
  string,
  { items: Record<string, number>; rewardCoins: number; rewardXp: number }
> = {
  bakers_basket: { items: { wheat: 2 }, rewardCoins: 25, rewardXp: 10 },
  market_stall: { items: { oats: 2, carrots: 2 }, rewardCoins: 40, rewardXp: 20 },
  soup_kitchen: { items: { carrots: 2, wheat: 2 }, rewardCoins: 45, rewardXp: 20 },
  autumn_festival: { items: { pumpkin: 1, sunflower: 2 }, rewardCoins: 90, rewardXp: 50 },
  village_pantry: { items: { oats: 4 }, rewardCoins: 30, rewardXp: 15 },
};

export async function getOrCreateDailyOrders(
  db: Firestore,
  uid: string,
  roundDate: string,
): Promise<TownOrdersDoc> {
  const economy = await assertTownFeatureEnabled(db);
  const ordersRef = db.collection('users').doc(uid).collection('townOrders').doc(roundDate);
  const userRef = db.collection('users').doc(uid);

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ordersRef);
    if (snap.exists) {
      return snap.data() as TownOrdersDoc;
    }

    const userSnap = await tx.get(userRef);
    const isPro = Boolean(userSnap.data()?.pro?.active);
    const orderCount = isPro ? economy.dailyOrders.pro : economy.dailyOrders.free;

    const templateKeys = Object.keys(ORDER_TEMPLATES);
    const orders: TownOrderItem[] = [];

    for (let i = 0; i < orderCount; i++) {
      const key = templateKeys[i % templateKeys.length]!;
      const tpl = ORDER_TEMPLATES[key]!;
      orders.push({
        id: `ord_${i + 1}`,
        templateKey: key,
        items: tpl.items,
        rewardCoins: tpl.rewardCoins,
        rewardXp: tpl.rewardXp,
        done: false,
      });
    }

    const newOrdersDoc: TownOrdersDoc = {
      unlocked: true,
      orders,
    };

    tx.set(ordersRef, newOrdersDoc);
    return newOrdersDoc;
  });
}

export async function deliverOrder(
  db: Firestore,
  uid: string,
  params: { roundDate: string; orderId: string },
): Promise<{ success: boolean; rewardCoins: number }> {
  await assertTownFeatureEnabled(db);

  const ordersRef = db.collection('users').doc(uid).collection('townOrders').doc(params.roundDate);
  const inventoryRef = db.collection('users').doc(uid).collection('townInventory').doc('main');
  const townRef = db.collection('users').doc(uid).collection('town').doc('main');

  return await db.runTransaction(async (tx) => {
    const ordersSnap = await tx.get(ordersRef);
    if (!ordersSnap.exists) {
      throw new Error('Daily orders not generated for this date');
    }
    const ordersData = ordersSnap.data() as TownOrdersDoc;
    if (!ordersData.unlocked) {
      throw new Error("Daily orders are locked. Play today's round first.");
    }

    const order = ordersData.orders.find((o) => o.id === params.orderId);
    if (!order) {
      throw new Error(`Order ${params.orderId} not found`);
    }
    if (order.done) {
      throw new Error('Order is already delivered');
    }

    // Check inventory for required crops
    const invSnap = await tx.get(inventoryRef);
    const inventory = invSnap.exists ? (invSnap.data() as TownInventoryDoc).crops || {} : {};

    for (const [cropId, reqQty] of Object.entries(order.items)) {
      const currentQty = inventory[cropId] || 0;
      if (currentQty < reqQty) {
        throw new Error(`Insufficient crops: need ${reqQty} ${cropId}, have ${currentQty}`);
      }
    }

    // Deduct crops from inventory
    const updatedInventory: Record<string, number> = { ...inventory };
    for (const [cropId, reqQty] of Object.entries(order.items)) {
      updatedInventory[cropId] = (updatedInventory[cropId] ?? 0) - reqQty;
    }
    tx.set(inventoryRef, { crops: updatedInventory }, { merge: true });

    // Mark order done
    const updatedOrders = ordersData.orders.map((o) =>
      o.id === params.orderId ? { ...o, done: true } : o,
    );
    tx.update(ordersRef, { orders: updatedOrders });

    // Credit reward coins to 'town' bucket
    await creditWallet({
      transaction: tx,
      db,
      uid,
      amount: order.rewardCoins,
      bucket: 'town',
      reason: 'order',
      refId: params.orderId,
      idempotencyKey: `order:${uid}:${params.roundDate}:${params.orderId}`,
    });

    // Advance tutorial step 2 -> 3 if delivering order
    const townSnap = await tx.get(townRef);
    if (townSnap.exists) {
      const townData = townSnap.data() as TownDoc;
      if (townData.tutorialStep === 2) {
        tx.update(townRef, {
          tutorialStep: 3,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return {
      success: true,
      rewardCoins: order.rewardCoins,
    };
  });
}
